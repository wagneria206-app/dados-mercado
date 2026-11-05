/* ---------- calendário das divulgações dos EUA (datas dos calendários oficiais do BLS e do BEA)
   BLS: www.bls.gov/schedule (emprego, CPI e PPI); BEA: www.bea.gov/news/schedule (PIB e renda e gastos pessoais, com o PCE).
   Todas saem às 8h30 de Nova York. Atualizar uma vez por ano, quando os órgãos publicam o calendário seguinte. */
const EUA_CAL_ATE="2027-12-22";
const EUA_CAL_T={emp:["Emprego (payroll e desemprego)","BLS"],cpi:["Inflação ao consumidor (CPI)","BLS"],ppi:["Inflação ao produtor (PPI)","BLS"],
  pib:["PIB","BEA"],pce:["Renda e gastos pessoais, com o PCE","BEA"]};
const EUA_CAL=[
  ["2026-11-06","emp","out/26"],["2026-11-10","cpi","out/26"],["2026-11-13","ppi","out/26"],["2026-11-25","pib","3º tri/26, 2ª estimativa"],["2026-11-25","pce","out/26"],
  ["2026-12-04","emp","nov/26"],["2026-12-10","cpi","nov/26"],["2026-12-15","ppi","nov/26"],["2026-12-23","pib","3º tri/26, 3ª estimativa"],["2026-12-23","pce","nov/26"],
  ["2027-01-08","emp","dez/26"],["2027-01-13","cpi","dez/26"],["2027-01-14","ppi","dez/26"],["2027-01-28","pib","4º tri/26, prévia"],["2027-01-28","pce","dez/26"],
  ["2027-02-05","emp","jan/27"],["2027-02-11","cpi","jan/27"],["2027-02-12","ppi","jan/27"],["2027-02-25","pib","4º tri/26, 2ª estimativa"],["2027-02-25","pce","jan/27"],
  ["2027-03-05","emp","fev/27"],["2027-03-10","cpi","fev/27"],["2027-03-12","ppi","fev/27"],["2027-03-31","pib","4º tri/26, 3ª estimativa"],["2027-03-31","pce","fev/27"],
  ["2027-04-02","emp","mar/27"],["2027-04-13","cpi","mar/27"],["2027-04-14","ppi","mar/27"],["2027-04-29","pib","1º tri/27, prévia"],["2027-04-29","pce","mar/27"],
  ["2027-05-07","emp","abr/27"],["2027-05-12","cpi","abr/27"],["2027-05-13","ppi","abr/27"],["2027-05-27","pib","1º tri/27, 2ª estimativa"],["2027-05-27","pce","abr/27"],
  ["2027-06-04","emp","mai/27"],["2027-06-10","cpi","mai/27"],["2027-06-11","ppi","mai/27"],["2027-06-25","pib","1º tri/27, 3ª estimativa"],["2027-06-25","pce","mai/27"],
  ["2027-07-02","emp","jun/27"],["2027-07-14","cpi","jun/27"],["2027-07-15","ppi","jun/27"],["2027-07-29","pib","2º tri/27, prévia"],["2027-07-29","pce","jun/27"],
  ["2027-08-06","emp","jul/27"],["2027-08-10","ppi","jul/27"],["2027-08-11","cpi","jul/27"],["2027-08-25","pib","2º tri/27, 2ª estimativa"],["2027-08-25","pce","jul/27"],
  ["2027-09-03","emp","ago/27"],["2027-09-10","ppi","ago/27"],["2027-09-14","cpi","ago/27"],["2027-09-30","pib","2º tri/27, 3ª estimativa"],["2027-09-30","pce","ago/27"],
  ["2027-10-08","emp","set/27"],["2027-10-14","cpi","set/27"],["2027-10-15","ppi","set/27"],["2027-10-28","pib","3º tri/27, prévia"],["2027-10-28","pce","set/27"],
  ["2027-11-05","emp","out/27"],["2027-11-10","cpi","out/27"],["2027-11-12","ppi","out/27"],["2027-11-24","pib","3º tri/27, 2ª estimativa"],["2027-11-24","pce","out/27"],
  ["2027-12-03","emp","nov/27"],["2027-12-10","cpi","nov/27"],["2027-12-15","ppi","nov/27"],["2027-12-22","pib","3º tri/27, 3ª estimativa"],["2027-12-22","pce","nov/27"]];
/* 8h30 em Nova York = 9h30 de Brasília no horário de verão americano (2º domingo de março ao 1º domingo de novembro) e 10h30 no resto do ano */
function euaHoraBr(d){const y=+d.slice(0,4),dom=(m,n)=>{const p=new Date(Date.UTC(y,m,1)).getUTCDay();return 1+((7-p)%7)+7*(n-1)},ini=Date.UTC(y,2,dom(2,2)),fim=Date.UTC(y,10,dom(10,1)),t=Date.parse(d+"T00:00:00Z");return t>=ini&&t<fim?"9h30":"10h30"}
function euaCalProx(dias){const hj=new Date().toISOString().slice(0,10),lim=new Date(Date.now()+(dias||9999)*864e5).toISOString().slice(0,10);return EUA_CAL.filter(x=>x[0]>=hj&&x[0]<=lim)}
