(() => {
  'use strict';
  const style = document.createElement('style');
  style.id = 'idk-layout-final-style';
  style.textContent = `
    /* Final desktop layout: Start lives on the bottom-left. */
    #start-toggle {
      left: 16px !important;
      right: auto !important;
      bottom: 14px !important;
    }
    #start-menu {
      left: 16px !important;
      right: auto !important;
      bottom: 70px !important;
    }
    /* Keep the Echo companion comfortably above the dock. */
    #echo-companion {
      bottom: 150px !important;
    }
    #desktop[data-dock="right"] #echo-companion,
    #desktop[data-dock="left"] #echo-companion {
      bottom: 150px !important;
    }
  `;
  document.head.appendChild(style);
})();
