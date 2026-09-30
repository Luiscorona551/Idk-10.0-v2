import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { WebSocketServer } from 'ws';

const DATA_DIR = process.env.IDK_VM_DATA_DIR || path.resolve(process.cwd(), 'data');
const VM_DATA_FILE = path.join(DATA_DIR, 'idk-vms.json');
const DISK_DIR = path.join(DATA_DIR, 'vm-disks');
const QEMU_BINARY = process.env.QEMU_BINARY || 'qemu-system-x86_64';
const QEMU_IMG_BINARY = process.env.QEMU_IMG_BINARY || 'qemu-img';
const ENABLE_QEMU = process.env.ENABLE_QEMU !== 'false';
const running = new Map();
const vncSockets = new Map();
const vmVnc = new Map();
const vncWsServer = new WebSocketServer({ noServer: true });
vncWsServer.on('connection', (ws, socket) => {
  const target = socket.__idkVncTarget;
  if (!target) return ws.close();
  const tcp = net.connect(target.port, '127.0.0.1');
  vncSockets.set(ws, tcp);
  tcp.on('data', data => { if (ws.readyState === 1) ws.send(data); });
  tcp.on('error', () => { try { ws.close(); } catch {} });
  tcp.on('close', () => { try { ws.close(); } catch {} });
  ws.on('message', data => { if (!tcp.destroyed) tcp.write(Buffer.from(data)); });
  ws.on('close', () => { vncSockets.delete(ws); tcp.destroy(); });
});

const allowedNetworks = new Set(['nat', 'bridged', 'isolated', 'host-only']);
const allowedDisplays = new Set(['default', 'virtio', 'vga', 'qxl', 'vmware']);
const allowedSounds = new Set(['hda', 'ac97', 'sb16', 'virtio', 'none']);
const allowedDiskBuses = new Set(['ide', 'sata', 'scsi', 'virtio', 'nvme']);
const allowedFirmwares = new Set(['bios', 'uefi']);
const allowedAdapters = new Set(['virtio', 'e1000', 'rtl8139']);

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(DISK_DIR, { recursive: true });
  try { await fs.access(VM_DATA_FILE); } catch { await fs.writeFile(VM_DATA_FILE, '[]'); }
}
async function listVMs() { await ensureStore(); return JSON.parse(await fs.readFile(VM_DATA_FILE, 'utf8')); }
async function saveVMs(vms) { await ensureStore(); const temp=VM_DATA_FILE+'.tmp'; await fs.writeFile(temp,JSON.stringify(vms,null,2)); await fs.rename(temp,VM_DATA_FILE); }
async function getVM(id) { return (await listVMs()).find(vm=>vm.id===id)||null; }
async function createVM(vm) { const vms=await listVMs(); vms.push(vm); await saveVMs(vms); return vm; }
async function updateVM(id,patch) { const vms=await listVMs(); const index=vms.findIndex(vm=>vm.id===id); if(index===-1)return null; vms[index]={...vms[index],...patch,id}; await saveVMs(vms); return vms[index]; }
async function deleteVM(id) { const vms=await listVMs(); const next=vms.filter(vm=>vm.id!==id); if(next.length===vms.length)return false; await saveVMs(next); return true; }

function validateVM(input) {
  const name=String(input.name||'').trim(), cpuCores=Number(input.cpuCores), ramMb=Number(input.ramMb), diskGb=Number(input.diskGb);
  if(!name)return 'VM name is required';
  if(!Number.isInteger(cpuCores)||cpuCores<1||cpuCores>128)return 'CPU cores must be 1-128';
  if(!Number.isInteger(ramMb)||ramMb<256||ramMb>1048576)return 'RAM must be 256-1048576 MB';
  if(!Number.isInteger(diskGb)||diskGb<1||diskGb>65536)return 'Disk size must be 1-65536 GB';
  if(!allowedNetworks.has(input.network||'nat'))return 'Invalid network mode';
  if(!allowedDisplays.has(input.display||'default'))return 'Invalid display adapter';
  if(!allowedSounds.has(input.soundDevice||'hda'))return 'Invalid sound device';
  if(!allowedDiskBuses.has(input.diskBus||'sata'))return 'Invalid disk bus';
  if(!allowedFirmwares.has(input.firmware||'bios'))return 'Invalid firmware';
  if(!allowedAdapters.has(input.networkAdapter||'virtio'))return 'Invalid network adapter';
  const partitions=Array.isArray(input.partitions)?input.partitions:[];
  if(partitions.length>32)return 'Too many partitions';
  const partitionTotal=partitions.reduce((sum,p)=>sum+Math.max(0,Number(p.sizeGb)||0),0);
  if(partitionTotal>diskGb)return 'Partition sizes exceed the virtual disk size';
  return null;
}
function qemuStatus(){return{enabled:ENABLE_QEMU,binary:QEMU_BINARY,running:[...running.keys()].map(id=>({id,vncPort:vmVnc.get(id)||null}))};}
function allocateVncPort(id) { if (vmVnc.has(id)) return vmVnc.get(id); const used=new Set(vmVnc.values()); for(let port=5901;port<6000;port++){if(!used.has(port)){vmVnc.set(id,port);return port;}} throw new Error('No VNC ports available'); }
function diskPath(vm){return path.join(DISK_DIR,vm.id+'.qcow2');}
function spawnAsync(binary,args) {
  return new Promise((resolve,reject)=>{const child=spawn(binary,args,{stdio:'ignore'});let settled=false;child.once('error',e=>{if(!settled){settled=true;reject(e);}});child.once('exit',(code,signal)=>{if(!settled){settled=true;code===0?resolve():reject(new Error(binary+' exited with code '+code+(signal?' ('+signal+')':'')));}});});
}
async function ensureDisk(vm) {
  const file=diskPath(vm);
  try { const st=await fs.stat(file); if(st.size>0)return file; } catch {}
  await spawnAsync(QEMU_IMG_BINARY,['create','-f','qcow2',file,String(vm.diskGb)+'G']);
  return file;
}
function displayArgs(vm,args){ if(vm.display==='virtio')args.push('-vga','virtio'); else if(vm.display==='qxl')args.push('-vga','qxl'); else if(vm.display==='vmware')args.push('-vga','vmware'); else if(vm.display==='vga')args.push('-vga','std'); else args.push('-vga','std'); }
function soundArgs(vm,args){ if(vm.soundDevice==='none')return; args.push('-audiodev','driver=none,id=audio0'); if(vm.soundDevice==='hda'){args.push('-device','ich9-intel-hda,id=sound0','-device','hda-duplex,audiodev=audio0');} else {const map={ac97:'AC97',sb16:'sb16',virtio:'virtio-sound-pci'};args.push('-device',(map[vm.soundDevice]||'AC97')+',audiodev=audio0');} }
function networkArgs(vm,args){ if(vm.network==='isolated'||vm.network==='host-only'){args.push('-nic','none');return;} const model=vm.networkAdapter||'virtio'; args.push('-nic',(vm.network==='bridged'?'bridge,br=br0,model=':'user,model=')+model); }
async function startQemu(vm) {
  if(!ENABLE_QEMU){const error=new Error('QEMU execution is disabled. Set ENABLE_QEMU=true on a dedicated VM host.');error.code='QEMU_DISABLED';throw error;}
  if(running.has(vm.id))return running.get(vm.id);
  const disk=await ensureDisk(vm);
  const cpuModel = vm.cpuModel === 'qemu64' ? 'qemu64' : vm.cpuModel === 'max' ? 'max' : 'max';
  const args=['-name',vm.name,'-m',String(vm.ramMb),'-smp',String(vm.cpuCores),'-cpu',cpuModel,'-accel','tcg,thread=multi','-nodefaults'];
  if(vm.firmware==='uefi') args.push('-machine','q35');
  const driveBus=vm.diskBus==='nvme'?'none':vm.diskBus;
  if(vm.diskBus==='nvme'){args.push('-drive','file='+disk+',if=none,id=disk0,format=qcow2','-device','nvme,drive=disk0,serial=IDKDISK');}
  else args.push('-drive','file='+disk+',if='+(driveBus==='sata'?'ide':driveBus)+',format=qcow2');
  displayArgs(vm,args); soundArgs(vm,args); networkArgs(vm,args); const vncPort=allocateVncPort(vm.id); args.push('-vnc','127.0.0.1:'+(vncPort-5900),'-display','none');
  if(vm.isoId){ const isoName=String(vm.isoName||vm.iso||'iso').replace(/[^a-zA-Z0-9._-]/g,'').slice(0,160)||'iso'; const isoFile=path.join(DISK_DIR,String(vm.isoId).replace(/[^a-zA-Z0-9_-]/g,'')+'-'+isoName); try{await fs.access(isoFile);args.push('-cdrom',isoFile);}catch{} }
  const child=spawn(QEMU_BINARY,args,{stdio:'ignore'});
  const processInfo={pid:child.pid,startedAt:new Date().toISOString(),diskPath:disk};
  running.set(vm.id,processInfo); child.once('exit',()=>running.delete(vm.id)); child.once('error',()=>running.delete(vm.id)); return processInfo;
}
function stopQemu(id){const info=running.get(id);if(!info)return false;try{process.kill(info.pid,'SIGTERM');}catch{}running.delete(id);vmVnc.delete(id);return true;}
async function restartQemu(vm){stopQemu(vm.id);return startQemu(vm);}

export function vmBackendStatus(){return{enabled:true,qemu:qemuStatus(),dataFile:VM_DATA_FILE,diskDirectory:DISK_DIR};}

export function vmRoutes(router) {
  const setCors=(req,res,next)=>{const origin=req.get('origin');if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type, X-ISO-Name');res.setHeader('Access-Control-Max-Age','600');}if(req.method==='OPTIONS')return res.sendStatus(204);next();};
  router.use(setCors);
  router.get('/health',(req,res)=>res.json({ok:true,service:'idk-vm-backend',version:'0.3.0',hostedBy:'Idk 10.0 server',time:new Date().toISOString()}));
  router.get('/host',(req,res)=>res.json({ok:true,virtualization:qemuStatus()}));
  router.get('/vms',async(req,res)=>res.json({ok:true,vms:await listVMs()}));
  router.put('/isos/:id', async (req,res)=>{ const id=String(req.params.id||'').replace(/[^a-zA-Z0-9_-]/g,''); const name=String(req.get('x-iso-name')||'iso').replace(/[^a-zA-Z0-9._-]/g,'').slice(0,160)||'iso'; if(!id)return res.status(400).json({ok:false,error:'ISO id is required'}); const file=path.join(DISK_DIR,id+'-'+name); try{await fs.mkdir(DISK_DIR,{recursive:true}); const chunks=[]; let bytes=0; req.on('data',chunk=>{bytes+=chunk.length;if(bytes>20*1024*1024*1024) req.destroy(new Error('ISO is too large')); else chunks.push(chunk);}); req.on('end',async()=>{try{await fs.writeFile(file,Buffer.concat(chunks));res.json({ok:true,id,name,bytes,path:file});}catch(error){res.status(500).json({ok:false,error:error.message});}}); req.on('error',error=>res.status(400).json({ok:false,error:error.message}));}catch(error){res.status(500).json({ok:false,error:error.message});} });
  router.post('/vms',async(req,res)=>{const error=validateVM(req.body||{});if(error)return res.status(400).json({ok:false,error});const now=new Date().toISOString();const vm={id:crypto.randomUUID(),name:String(req.body.name).trim(),cpuCores:Number(req.body.cpuCores),ramMb:Number(req.body.ramMb),diskGb:Number(req.body.diskGb),cpuModel:req.body.cpuModel||'host',cpuTopology:req.body.cpuTopology||'simple',diskBus:req.body.diskBus||'sata',network:req.body.network||'nat',networkAdapter:req.body.networkAdapter||'virtio',mac:String(req.body.mac||''),display:req.body.display||'default',videoMemoryMb:Number(req.body.videoMemoryMb)||32,resolution:String(req.body.resolution||'1280x720'),soundDevice:req.body.soundDevice||'hda',accel3d:Boolean(req.body.accel3d),firmware:req.body.firmware||'bios',bootDevice:req.body.bootDevice||'disk',bootOrder:Array.isArray(req.body.bootOrder)?req.body.bootOrder:['disk','iso','network'],iso:String(req.body.iso||'').trim(),isoId:String(req.body.isoId||''),isoName:String(req.body.isoName||req.body.iso||'').trim(),partitions:Array.isArray(req.body.partitions)?req.body.partitions:[],status:'stopped',createdAt:now,updatedAt:now};res.status(201).json({ok:true,vm:await createVM(vm)});});
  router.get('/vms/:id',async(req,res)=>{const vm=await getVM(req.params.id);if(!vm)return res.status(404).json({ok:false,error:'VM not found'});res.json({ok:true,vm});});
  router.patch('/vms/:id',async(req,res)=>{const current=await getVM(req.params.id);if(!current)return res.status(404).json({ok:false,error:'VM not found'});const candidate={...current,...(req.body||{})};const error=validateVM(candidate);if(error)return res.status(400).json({ok:false,error});res.json({ok:true,vm:await updateVM(req.params.id,{...candidate,updatedAt:new Date().toISOString()})});});
  router.delete('/vms/:id',async(req,res)=>{if(await getVM(req.params.id))stopQemu(req.params.id);if(!await deleteVM(req.params.id))return res.status(404).json({ok:false,error:'VM not found'});try{await fs.unlink(diskPath({id:req.params.id}));}catch{}res.json({ok:true});});
  router.get('/vms/:id/console',async(req,res)=>{ const vm=await getVM(req.params.id); const port=vmVnc.get(req.params.id); if(!vm||!port||!running.has(req.params.id)) return res.status(409).json({ok:false,error:'VM is not running'}); res.json({ok:true,host:req.get('host'),path:'/api/vm/vms/'+encodeURIComponent(req.params.id)+'/vnc',port}); });
  router.post('/vms/:id/start',async(req,res)=>{const vm=await getVM(req.params.id);if(!vm)return res.status(404).json({ok:false,error:'VM not found'});try{const processInfo=await startQemu(vm);await updateVM(vm.id,{status:'running',updatedAt:new Date().toISOString()});res.json({ok:true,status:'running',process:processInfo});}catch(error){res.status(503).json({ok:false,error:error.message,code:error.code||'QEMU_ERROR'});}});
  router.post('/vms/:id/stop',async(req,res)=>{const vm=await getVM(req.params.id);if(!vm)return res.status(404).json({ok:false,error:'VM not found'});stopQemu(vm.id);await updateVM(vm.id,{status:'stopped',updatedAt:new Date().toISOString()});res.json({ok:true,status:'stopped'});});
  router.post('/vms/:id/restart',async(req,res)=>{const vm=await getVM(req.params.id);if(!vm)return res.status(404).json({ok:false,error:'VM not found'});try{const processInfo=await restartQemu(vm);await updateVM(vm.id,{status:'running',updatedAt:new Date().toISOString()});res.json({ok:true,status:'running',process:processInfo});}catch(error){res.status(503).json({ok:false,error:error.message,code:error.code||'QEMU_ERROR'});}});
}
export async function handleVmUpgrade(req, socket, head) {
  const match = String(req.url||'').match(/^\/api\/vm\/vms\/([^/]+)\/vnc(?:\?|$)/);
  if (!match) return false;
  const id=decodeURIComponent(match[1]); const port=vmVnc.get(id);
  if(!port || !running.has(id)){ socket.destroy(); return true; }
  socket.__idkVncTarget={port};
  vncWsServer.handleUpgrade(req,socket,head,ws=>vncWsServer.emit('connection',ws,socket));
  return true;
}
