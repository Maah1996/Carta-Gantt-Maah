// ── ESTADO GLOBAL ──────────────────────────────────────────────────────────
const TODAY = new Date();
TODAY.setHours(0,0,0,0);

let acts = [];
let cType = 'revision';
let cFreq = 'puntual';
let editFreq = 'puntual';
let nextId = 200;
let currentFilter = 'all';
let currentMonthKey = 'current';
let modalCb = null;

const MNAMES  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MSHORT  = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const DNAMES  = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];

// ── FIREBASE CONFIG ──────────────────────────────────────────
const FB_CONFIG = {
  apiKey:            "AIzaSyB0f_Sh2xiDgvB9_-nyp76Ol-XvhhyvcXA",
  authDomain:        "gantt-maah.firebaseapp.com",
  databaseURL:       "https://gantt-maah-default-rtdb.firebaseio.com",
  projectId:         "gantt-maah",
  storageBucket:     "gantt-maah.firebasestorage.app",
  messagingSenderId: "299934642229",
  appId:             "1:299934642229:web:87681b489cdc2a5452c17c"
};
const FB_CONFIGURED = FB_CONFIG.apiKey !== "TU_API_KEY";

let db = null;
let dbRef = null;
let myDbRef = null;
let fbListener = null;
let fbOnline = false;

let currentUser = null;
let usuariosCache = [];
let pendingAuthUid = null;
let usuariosCargados = false;
let usuariosCargando = false;
let viewingUserId = null;
let viewingUserName = null;
let currentTipoFilter = null;
