import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const DATA_DIR = process.env.IDK_VM_DATA_DIR || path.resolve(process.cwd(), 'data');
const VM_DATA_FILE = path.join(DATA_DIR, 'idk-vms.json');
const QEMU_BINARY = process.env.QEMU_BINARY || 'qemu-system-x86_64';
const ENABLE_QEMU = process.env.ENABLE_QEMU === 'true';
const running = new Map();

const allowedNetworks = new Set(['nat', 'bridged', 'isolated']);
const allowedDisplays = new Set(['default', 'virtio', 'vga']);

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try { await fs.access(VM_DATA_FILE); }
  catch { await fs.writeFile(VM_DATA_FILE, '[]'); }
}
async function listVMs() { await ensureStore(); return JSON.parse(await fs.readFile(VM_DATA_FILE, 'utf8')); }
async function saveVMs(vms) {
  await ensureStore();
  const temp = VM_DATA_FILE + '.tmp';
  await fs.writeFile(temp, JSON.stringify(vms, null, 2));
  await fs.rename(temp, VM_DATA_FILE);
}
async function getVM(id) { return (await listVMs()).find(vm => vm.id === id) || null; }
async function createVM(vm) { const vms = await listVMs(); vms.push(vm); await saveVMs(vms); return vm; }
async function updateVM(id, patch) {
  const vms = await listVMs();
  const index = vms.findIndex(vm => vm.id === id);
  if (index === -1) return null;
  vms[index] = { ...vms[index], ...patch, id };
  await saveVMs(vms);
  return vms[index];
}
async function deleteVM(id) {
  const vms = await listVMs();
  const next = vms.filter(vm => vm.id !== id);
  if (next.length === vms.length) return false;
  await saveVMs(next);
  return true;
}
function validateVM(input) {
  const name = String(input.name || '').trim();
  const cpuCores = Number(input.cpuCores);
  const ramMb = Number(input.ramMb);
  const diskGb = Number(input.diskGb);
  if (!name) return 'VM name is required';
  if (!Number.isInteger(cpuCores) || cpuCores < 1 || cpuCores > 128) return 'CPU cores must be 1-128';
  if (!Number.isInteger(ramMb) || ramMb < 256 || ramMb > 1048576) return 'RAM must be 256-1048576 MB';
  if (!Number.isInteger(diskGb) || diskGb < 1 || diskGb > 65536) return 'Disk size must be 1-65536 GB';
  if (!allowedNetworks.has(input.network || 'nat')) return 'Invalid network mode';
  if (!allowedDisplays.has(input.display || 'default')) return 'Invalid display mode';
  return null;
}
function qemuStatus() {
  return { enabled: ENABLE_QEMU, binary: QEMU_BINARY, running: [...running.keys()] };
}
function startQemu(vm) {
  if (!ENABLE_QEMU) {
    const error = new Error('QEMU execution is disabled. Set ENABLE_QEMU=true on a dedicated VM host.');
    error.code = 'QEMU_DISABLED';
    throw error;
  }
  if (running.has(vm.id)) return running.get(vm.id);
  const args = ['-name', vm.name, '-m', String(vm.ramMb), '-smp', String(vm.cpuCores), '-display', 'none', '-nodefaults'];
  const child = spawn(QEMU_BINARY, args, { stdio: 'ignore' });
  const processInfo = { pid: child.pid, startedAt: new Date().toISOString() };
  running.set(vm.id, processInfo);
  child.once('exit', () => running.delete(vm.id));
  child.once('error', () => running.delete(vm.id));
  return processInfo;
}
function stopQemu(id) {
  const info = running.get(id);
  if (!info) return false;
  try { process.kill(info.pid, 'SIGTERM'); } catch {}
  running.delete(id);
  return true;
}
function restartQemu(vm) { stopQemu(vm.id); return startQemu(vm); }

export function vmBackendStatus() {
  return { enabled: true, qemu: qemuStatus(), dataFile: VM_DATA_FILE };
}

export function vmRoutes(router) {
  const setCors = (req, res, next) => {
    const origin = req.get('origin');
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  };
  router.use(setCors);

  router.get('/health', (req, res) => res.json({ ok: true, service: 'idk-vm-backend', version: '0.2.0', hostedBy: 'Idk 10.0 server', time: new Date().toISOString() }));
  router.get('/host', (req, res) => res.json({ ok: true, virtualization: qemuStatus() }));
  router.get('/vms', async (req, res) => res.json({ ok: true, vms: await listVMs() }));
  router.post('/vms', async (req, res) => {
    const error = validateVM(req.body || {});
    if (error) return res.status(400).json({ ok: false, error });
    const now = new Date().toISOString();
    const vm = {
      id: crypto.randomUUID(), name: String(req.body.name).trim(),
      cpuCores: Number(req.body.cpuCores), ramMb: Number(req.body.ramMb), diskGb: Number(req.body.diskGb),
      network: req.body.network || 'nat', display: req.body.display || 'default',
      sound: req.body.sound !== false, iso: String(req.body.iso || '').trim(),
      status: 'stopped', createdAt: now, updatedAt: now
    };
    res.status(201).json({ ok: true, vm: await createVM(vm) });
  });
  router.get('/vms/:id', async (req, res) => {
    const vm = await getVM(req.params.id);
    if (!vm) return res.status(404).json({ ok: false, error: 'VM not found' });
    res.json({ ok: true, vm });
  });
  router.patch('/vms/:id', async (req, res) => {
    const current = await getVM(req.params.id);
    if (!current) return res.status(404).json({ ok: false, error: 'VM not found' });
    const candidate = { ...current, ...(req.body || {}) };
    const error = validateVM(candidate);
    if (error) return res.status(400).json({ ok: false, error });
    res.json({ ok: true, vm: await updateVM(req.params.id, { ...candidate, updatedAt: new Date().toISOString() }) });
  });
  router.delete('/vms/:id', async (req, res) => {
    if (await getVM(req.params.id)) stopQemu(req.params.id);
    if (!await deleteVM(req.params.id)) return res.status(404).json({ ok: false, error: 'VM not found' });
    res.json({ ok: true });
  });
  router.post('/vms/:id/start', async (req, res) => {
    const vm = await getVM(req.params.id);
    if (!vm) return res.status(404).json({ ok: false, error: 'VM not found' });
    try {
      const processInfo = startQemu(vm);
      await updateVM(vm.id, { status: 'running', updatedAt: new Date().toISOString() });
      res.json({ ok: true, status: 'running', process: processInfo });
    } catch (error) { res.status(503).json({ ok: false, error: error.message, code: error.code || 'QEMU_ERROR' }); }
  });
  router.post('/vms/:id/stop', async (req, res) => {
    const vm = await getVM(req.params.id);
    if (!vm) return res.status(404).json({ ok: false, error: 'VM not found' });
    stopQemu(vm.id);
    await updateVM(vm.id, { status: 'stopped', updatedAt: new Date().toISOString() });
    res.json({ ok: true, status: 'stopped' });
  });
  router.post('/vms/:id/restart', async (req, res) => {
    const vm = await getVM(req.params.id);
    if (!vm) return res.status(404).json({ ok: false, error: 'VM not found' });
    try {
      const processInfo = restartQemu(vm);
      await updateVM(vm.id, { status: 'running', updatedAt: new Date().toISOString() });
      res.json({ ok: true, status: 'running', process: processInfo });
    } catch (error) { res.status(503).json({ ok: false, error: error.message, code: error.code || 'QEMU_ERROR' }); }
  });
}
