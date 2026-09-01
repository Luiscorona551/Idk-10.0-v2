// The desktop lives behind this flow: server.js only serves it once /api/setup
// has handed out a session cookie. Without the Node backend the check falls
// back to a hash comparison, which is cosmetic — the real gate is the server.
const KEY_HASHES = [
  '01b2510065bec7ddc3759e22b3a821dfeee67ffee783ddf832c3c520dc1cfaaa',
  'c02098b59d704e21614f462778fc7f3440ef598b61b11e951b732f068e28376c',
  'd23c6491955aa882d27fffe4ba47c79b4f7f378cd8534421157941cdd236800c'
];
const KEY_GROUP_SIZE = 4;
const KEY_GROUPS = 3;
const KEY_MAX_LENGTH = KEY_GROUP_SIZE * KEY_GROUPS;

const $ = id => document.getElementById(id);
const screens = document.querySelectorAll('.screen');
const installMusic = $('install-audio');
const shutdownAudio = $('shutdown-audio');
const keyField = $('key-field');
const profileForm = $('profile-form');
const profileNameField = $('desired-account-name');
const profilePasswordField = $('profile-password');
const profilePasswordConfirm = $('profile-password-confirm');
const profileHintField = $('profile-password-hint');
const profileError = $('profile-error');
const profileSaveButton = $('profile-save-btn');
const profileSkipButton = $('profile-skip-btn');
const loginForm = $('login-form');
const loginAvatar = $('login-avatar');
const loginName = $('login-name');
const loginPassword = $('login-password');
const loginHint = $('login-hint');
const loginError = $('login-error');
const loginNoPassword = $('login-no-password');
const PANIC_URL = 'https://classroom.google.com/';
const TIMEZONE_KEY = 'timezone';
const TIMEZONE_OFFSET_KEY = 'timezoneOffset';
const TIMEZONE_DST_KEY = 'timezoneDST';
const PROFILE_KEY = 'idkProfile';
const PROFILE_IMAGES = [
  'profile-1.jpg',
  'profile-2.jpg',
  'profile-3.jpg',
  'profile-4.jpg'
];
const DEFAULT_PROFILE_IMAGE = PROFILE_IMAGES[0];

let unlocked = false;
let selectedProfileImage = DEFAULT_PROFILE_IMAGE;

function show(id) {
  screens.forEach(screen => screen.classList.remove('show'));
  $(id).classList.add('show');
}

function savedPanicURL() {
  try {
    return JSON.parse(localStorage.getItem('panicURL')) || PANIC_URL;
  } catch (e) {
    return PANIC_URL;
  }
}

function beginShutdown() {
  $('click-overlay').style.display = 'none';
  $('help-ui').classList.add('hide');
  installMusic.pause();
  show('shutdown-screen');
  shutdownAudio.currentTime = 0;
  shutdownAudio.play().catch(() => {});

  setTimeout(() => {
    window.close();
    window.location.replace(savedPanicURL());
  }, 5200);
}

async function sha256(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function readProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY));
    if (!saved || typeof saved !== 'object') return null;
    return {
      displayName: String(saved.displayName || '').trim().slice(0, 32),
      avatar: PROFILE_IMAGES.includes(saved.avatar) ? saved.avatar : DEFAULT_PROFILE_IMAGE,
      passwordHash: String(saved.passwordHash || ''),
      hint: String(saved.hint || '').trim().slice(0, 80)
    };
  } catch (e) {
    return null;
  }
}

function savedAccountName() {
  try {
    return String(JSON.parse(localStorage.getItem('chatName')) || '').trim().slice(0, 32);
  } catch (e) {
    return '';
  }
}

function writeProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    localStorage.setItem('chatName', JSON.stringify(profile.displayName));
  } catch (e) {
    // Continue when private browsing or storage limits block saving.
  }
}

function setSelectedAvatar(avatar) {
  selectedProfileImage = PROFILE_IMAGES.includes(avatar) ? avatar : DEFAULT_PROFILE_IMAGE;
  document.querySelectorAll('.profile-avatar-button').forEach(button => {
    const selected = button.dataset.avatar === selectedProfileImage;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-selected', String(selected));
  });
}

function prepareProfileSetup() {
  const profile = readProfile();
  profileNameField.value = profile?.displayName || savedAccountName();
  profilePasswordField.value = '';
  profilePasswordConfirm.value = '';
  profileHintField.value = '';
  profileError.textContent = '';
  setSelectedAvatar(profile?.avatar || DEFAULT_PROFILE_IMAGE);
  profileSkipButton.textContent = profile?.passwordHash ? 'Keep existing password' : 'Skip password setup';
}

function profileForLogin() {
  const profile = readProfile();
  return profile || {
    displayName: savedAccountName() || 'Guest',
    avatar: DEFAULT_PROFILE_IMAGE,
    passwordHash: '',
    hint: ''
  };
}

function normalizeKey(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, KEY_MAX_LENGTH);
}

function formatKey(value) {
  const normalized = normalizeKey(value);
  return normalized.match(new RegExp(`.{1,${KEY_GROUP_SIZE}}`, 'g'))?.join('-') ?? '';
}

keyField.addEventListener('input', () => {
  keyField.value = formatKey(keyField.value);
});

document.querySelectorAll('.profile-avatar-button').forEach(button => {
  button.addEventListener('click', () => setSelectedAvatar(button.dataset.avatar));
});

// Returns true when the key is accepted. The server sets the session cookie;
// if it is not running (static hosting) we compare hashes locally instead.
async function submitKey(key) {
  const normalizedKey = normalizeKey(key);
  try {
    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: normalizedKey })
    });
    if (res.status === 404) throw new Error('no backend');
    return res.ok;
  } catch (e) {
    return KEY_HASHES.includes(await sha256(normalizedKey));
  }
}

$('install-now-btn').addEventListener('click', () => {
  $('click-overlay').style.display = 'none';
  installMusic.play().catch(() => {});
  show('startup-screen');
  setTimeout(() => {
    show('setup1');
    $('help-ui').classList.remove('hide');
  }, 5000);
});

$('reg-next').addEventListener('click', () => {
  if ($('reg-no').checked) {
    alert('Closing Setup...');
    window.close();
    window.location.href = 'about:blank';
    return;
  }
  show('setup2');
});

$('accounts-next').addEventListener('click', () => {
  const name = $('account-name').value.trim();
  if (name) {
    try {
      localStorage.setItem('chatName', JSON.stringify(name));
    } catch (e) {
      // Continue setup when private browsing or browser storage blocks saving.
    }
  }
  show('setup3');
});

$('key-next').addEventListener('click', async () => {
  const button = $('key-next');
  button.disabled = true;
  unlocked = await submitKey(keyField.value);
  button.disabled = false;

  if (!unlocked) {
    $('error-text').style.display = 'block';
    return;
  }
  $('error-text').style.display = 'none';
  prepareProfileSetup();
  show('profile-setup-screen');
});

profileForm.addEventListener('submit', async event => {
  event.preventDefault();
  const name = profileNameField.value.trim().slice(0, 32);
  const password = profilePasswordField.value;
  const confirmation = profilePasswordConfirm.value;
  const existing = readProfile();
  profileError.textContent = '';

  if (!name) {
    profileError.textContent = 'Enter an account name first.';
    profileNameField.focus();
    return;
  }
  if (password !== confirmation) {
    profileError.textContent = 'The passwords do not match.';
    profilePasswordConfirm.focus();
    return;
  }
  if (!password && profileHintField.value.trim() && !existing?.passwordHash) {
    profileError.textContent = 'Add a password before adding a password hint.';
    profilePasswordField.focus();
    return;
  }

  profileSaveButton.disabled = true;
  try {
    const profile = {
      displayName: name,
      avatar: selectedProfileImage,
      passwordHash: password ? await sha256(password) : (existing?.passwordHash || ''),
      hint: password ? profileHintField.value.trim().slice(0, 80) : (existing?.hint || '')
    };
    writeProfile(profile);
    show('timezone-screen');
  } finally {
    profileSaveButton.disabled = false;
  }
});

profileSkipButton.addEventListener('click', () => {
  const existing = readProfile();
  const profile = {
    displayName: profileNameField.value.trim().slice(0, 32) || existing?.displayName || savedAccountName() || 'Guest',
    avatar: selectedProfileImage || existing?.avatar || DEFAULT_PROFILE_IMAGE,
    passwordHash: existing?.passwordHash || '',
    hint: existing?.hint || ''
  };
  writeProfile(profile);
  show('timezone-screen');
});

function timezoneOffsetMinutes(zone, date = new Date()) {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
      .formatToParts(date)
      .find(item => item.type === 'timeZoneName')?.value || 'GMT';
    if (part === 'GMT' || part === 'UTC') return 0;
    const match = part.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!match) return 0;
    return (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] || 0));
  } catch (e) {
    return 0;
  }
}

function formatOffset(minutes) {
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);
  return `GMT${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
}

function friendlyTimezone(zone) {
  if (zone === 'UTC') return 'Coordinated Universal Time';
  return zone.split('/').slice(-1)[0].replace(/_/g, ' ');
}

function populateTimezones() {
  const select = $('timezone-select');
  const known = new Set([...select.options].map(option => option.value));
  try {
    Intl.supportedValuesOf('timeZone').forEach(zone => {
      if (known.has(zone)) return;
      const option = document.createElement('option');
      option.value = zone;
      option.textContent = `(${formatOffset(timezoneOffsetMinutes(zone))}) ${friendlyTimezone(zone)}`;
      select.append(option);
    });
  } catch (e) {
    // The common zones above keep the selector usable in older browsers.
  }

  let preferred = 'America/Los_Angeles';
  try {
    const saved = localStorage.getItem(TIMEZONE_KEY);
    preferred = saved ? JSON.parse(saved) : Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (e) {}
  if ([...select.options].some(option => option.value === preferred)) select.value = preferred;
  try {
    const savedDST = localStorage.getItem(TIMEZONE_DST_KEY);
    if (savedDST !== null) $('timezone-dst').checked = JSON.parse(savedDST);
  } catch (e) {}
  updateTimezoneOffset();
}

function updateTimezoneOffset() {
  $('timezone-offset').textContent = `Selected offset: ${formatOffset(timezoneOffsetMinutes($('timezone-select').value))}`;
}

$('timezone-select').addEventListener('change', updateTimezoneOffset);
$('timezone-next').addEventListener('click', () => {
  const zone = $('timezone-select').value;
  const offset = timezoneOffsetMinutes(zone);
  try {
    localStorage.setItem(TIMEZONE_KEY, JSON.stringify(zone));
    localStorage.setItem(TIMEZONE_OFFSET_KEY, JSON.stringify(offset));
    localStorage.setItem(TIMEZONE_DST_KEY, JSON.stringify($('timezone-dst').checked));
    $('timezone-summary').textContent = `${zone} (${formatOffset(offset)}), daylight saving ${$('timezone-dst').checked ? 'enabled' : 'disabled'}.`;
  } catch (e) {
    // Continue setup when browser storage is unavailable.
  }
  show('setup4');
});

populateTimezones();

$('finish-btn').addEventListener('click', () => {
  installMusic.pause();
  show('region-screen');
});

const TRANSLATIONS = {
  ES: {
    title: 'Seleccione Región y Estado',
    desc: 'Elija su ubicación para configurar el idioma.',
    region: 'Región:',
    state: 'Estado / Provincia:',
    next: 'Siguiente'
  },
  FR: {
    title: "Sélectionnez la région et l'état",
    desc: 'Choisissez votre emplacement pour définir la langue.',
    region: 'Région :',
    state: 'État / Province :',
    next: 'Suivant'
  },
  DE: {
    title: 'Region und Bundesland auswählen',
    desc: 'Wählen Sie Ihren Standort aus.',
    region: 'Region:',
    state: 'Bundesland:',
    next: 'Weiter'
  },
  JP: {
    title: '地域と州を選択してください',
    desc: '言語を設定する場所を選択します。',
    region: '地域:',
    state: '州 / 県:',
    next: '次へ'
  },
  US: {
    title: 'Select Region and State',
    desc: 'Choose your location to set the language.',
    region: 'Region:',
    state: 'State / Province:',
    next: 'Next'
  }
};

$('region-select').addEventListener('change', () => {
  const copy = TRANSLATIONS[$('region-select').value] || TRANSLATIONS.US;
  $('region-title').textContent = copy.title;
  $('region-desc').textContent = copy.desc;
  $('region-label').textContent = copy.region;
  $('state-label').textContent = copy.state;
  $('region-btn').textContent = copy.next;
});

function prepareLogin() {
  const profile = profileForLogin();
  loginAvatar.onerror = () => {
    loginAvatar.onerror = null;
    loginAvatar.src = 'ugs-icon.jpeg';
  };
  loginAvatar.src = profile.avatar;
  loginName.textContent = profile.displayName;
  loginPassword.value = '';
  loginPassword.placeholder = profile.passwordHash ? 'Password' : 'No password set';
  loginError.textContent = '';
  loginHint.dataset.revealed = 'false';
  loginHint.hidden = !profile.hint;
  loginHint.textContent = 'Show password hint';
  loginNoPassword.hidden = Boolean(profile.passwordHash);
}

function enterDesktop() {
  window.location.replace('/desktop.html');
}

loginHint.addEventListener('click', () => {
  const profile = profileForLogin();
  if (!profile.hint) return;
  const revealed = loginHint.dataset.revealed === 'true';
  loginHint.dataset.revealed = String(!revealed);
  loginHint.textContent = revealed ? 'Show password hint' : `Hint: ${profile.hint}`;
});

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const profile = profileForLogin();
  if (!profile.passwordHash) {
    enterDesktop();
    return;
  }

  const submit = $('login-submit');
  submit.disabled = true;
  const matches = await sha256(loginPassword.value) === profile.passwordHash;
  submit.disabled = false;
  if (!matches) {
    loginError.textContent = 'Incorrect password.';
    if (profile.hint) {
      loginHint.hidden = false;
      loginHint.dataset.revealed = 'true';
      loginHint.textContent = `Hint: ${profile.hint}`;
    }
    loginPassword.select();
    return;
  }
  enterDesktop();
});

loginNoPassword.addEventListener('click', enterDesktop);

$('region-btn').addEventListener('click', () => {
  $('help-ui').classList.add('hide');
  show('welcome-screen');
  $('welcome-audio').play().catch(() => {});
  setTimeout(() => {
    prepareLogin();
    show('login-screen');
  }, 4500);
});

if (new URLSearchParams(window.location.search).get('shutdown') === '1') {
  beginShutdown();
}

$('help-ui').addEventListener('click', () => {
  const help = {
    setup1: 'This is the registration screen. Choose whether you want to register now or later.',
    setup2: 'Please enter your name and alt accounts.',
    setup3: 'Enter the product key. Ask the owner for it.',
    'profile-setup-screen': 'Choose your account name and profile picture. A password is recommended but optional.',
    setup4: "Your time zone is saved. Click 'Continue' to proceed to region settings.",
    'timezone-screen': 'Choose a global time zone and decide whether the clock should follow daylight saving changes.',
    'region-screen': 'Select your region and state to set your preferred language.',
    'login-screen': 'Enter your account password. If you skip password setup, choose Continue without a password.'
  };
  const current = [...screens].find(screen => screen.classList.contains('show'));
    alert(`IDK 10.0 ASSISTANCE:\n\n${help[current?.id] ?? "Click 'start now' to begin."}`);
});
