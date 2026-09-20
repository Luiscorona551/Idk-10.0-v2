(() => {
  const KEY='idk-boot-seen-v1';
  if(localStorage.getItem(KEY)==='1') return;
  const boot=document.createElement('div');
  boot.className='idk-boot-screen';
  boot.setAttribute('aria-label','Starting IDK');
  boot.innerHTML='<div class="idk-boot-flag" aria-hidden="true"><img class="boot-piece boot-tl" src="official-flag.jpg"><img class="boot-piece boot-tr" src="official-flag.jpg"><img class="boot-piece boot-bl" src="official-flag.jpg"><img class="boot-piece boot-br" src="official-flag.jpg"></div><div class="idk-boot-text">Starting IDK</div>';
  document.body.prepend(boot);
  const finish=()=>{boot.classList.add('done');localStorage.setItem(KEY,'1');setTimeout(()=>boot.remove(),900);};
  setTimeout(finish,3100);
})();