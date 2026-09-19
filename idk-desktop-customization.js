(() => {
  const KEY = { rows: 'desktopRows', gap: 'desktopIconGap', labels: 'desktopIconLabels' };
  const get = (key, fallback) => { try { const raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); } catch { return fallback; } };
  const set = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  function apply() {
    const desktop = document.getElementById('desktop'); if (!desktop) return;
    const rows = Math.max(2, Math.min(8, Number(get(KEY.rows, 6)) || 6));
    const gap = Math.max(4, Math.min(32, Number(get(KEY.gap, 14)) || 14));
    desktop.style.setProperty('--desktop-icon-rows', String(rows));
    desktop.style.setProperty('--desktop-icon-gap', gap + 'px');
    desktop.setAttribute('data-icon-labels', get(KEY.labels, true) !== false ? 'on' : 'off');
  }
  function resetLayout() { try { localStorage.removeItem('desktopOrder'); } catch {} window.location.reload(); }
  function addCustomization(root) {
    const section = document.createElement('section');
    section.className = 'desktop-customization-panel';
    section.innerHTML = '<h3>Desktop customization</h3><p class="sub">Make the desktop layout your own. Changes are saved on this device.</p>';
    const grid = document.createElement('div'); grid.className = 'desktop-customization-grid';
    const rows = document.createElement('select'); rows.className = 'field';
    [['3','3 rows'],['4','4 rows'],['5','5 rows'],['6','6 rows'],['7','7 rows'],['8','8 rows']].forEach(([v,l]) => { const o=document.createElement('option'); o.value=v; o.textContent=l; rows.append(o); });
    rows.value = String(get(KEY.rows, 6));
    const gap = document.createElement('input'); gap.className='field'; gap.type='range'; gap.min='4'; gap.max='32'; gap.step='2'; gap.value=String(get(KEY.gap,14));
    const gapValue=document.createElement('span'); gapValue.className='count'; gapValue.textContent=gap.value+'px';
    const labels=document.createElement('input'); labels.type='checkbox'; labels.checked=get(KEY.labels,true)!==false;
    const row=(label,control,hint='')=>{ const wrap=document.createElement('label'); wrap.className='desktop-customization-row'; const copy=document.createElement('span'); copy.innerHTML='<strong>'+label+'</strong>'+ (hint?'<small>'+hint+'</small>':''); wrap.append(copy,control); return wrap; };
    rows.addEventListener('change',()=>{set(KEY.rows,Number(rows.value));apply();});
    gap.addEventListener('input',()=>{set(KEY.gap,Number(gap.value));gapValue.textContent=gap.value+'px';apply();});
    labels.addEventListener('change',()=>{set(KEY.labels,labels.checked);apply();});
    grid.append(row('Icon rows',rows,'More rows keep large app collections organized into columns.'),row('Icon spacing',gap,'Adjust the space between app icons.'),row('Icon labels',labels,'Show or hide the text under each app.'));
    const reset=document.createElement('button'); reset.className='btn tab'; reset.type='button'; reset.textContent='Reset app layout';
    reset.addEventListener('click',()=>{if(window.confirm('Reset the saved app order and return to the default desktop layout?')) resetLayout();});
    section.append(grid,reset); root.append(section);
  }
  apply();
  if (window.APPS?.settings?.render) {
    const original=window.APPS.settings.render;
    window.APPS.settings.render=function(...args){const root=original.apply(this,args);addCustomization(root);return root;};
  }
  window.IDKDesktopCustomization={apply,resetLayout};
})();