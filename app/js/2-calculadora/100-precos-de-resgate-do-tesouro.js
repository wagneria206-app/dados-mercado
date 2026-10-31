/* ================= Preços de resgate do Tesouro Direto ================= */
let TD_ALL={};       // "KIND|data" -> {rate, price}
let MBASE=null;      // base da taxa de mercado escolhida no módulo público: "TD" ou "ANBIMA"
function tdRow(kind,d){return TD_ALL[kind+"|"+d]}
function defaultBase(kind,d){return tdRow(kind,d)?"TD":"ANBIMA"}

