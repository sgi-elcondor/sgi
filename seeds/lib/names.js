'use strict';
const { pick, randInt } = require('./rng');

const MALE   = ['Juan','Carlos','Andrés','Diego','Luis','Miguel','Pedro','Sebastián','Felipe','Alejandro','David','Daniel','Nicolás','Camilo','Jhon','Omar','Fabio','Mauricio','Gustavo','Hernán'];
const FEMALE = ['María','Ana','Laura','Diana','Sandra','Carolina','Patricia','Valentina','Isabella','Sofía','Catalina','Juliana','Natalia','Claudia','Marcela','Yolanda','Adriana','Luz','Gloria','Esperanza'];
const LAST   = ['García','Rodríguez','Martínez','López','González','Hernández','Pérez','Torres','Ramírez','Sánchez','Vargas','Castro','Moreno','Jiménez','Rojas','Díaz','Reyes','Gómez','Morales','Ortiz','Salazar','Mendoza','Ríos','Suárez','Guerrero','Medina','Cárdenas','Ruiz','Molina','Acosta','Parra','Cano','Muñoz','Arango','Zapata','Bermúdez','Ocampo','Osorio','Valencia','Aguirre'];
const CITIES = ['Manizales','Armenia','Pereira','Bucaramanga','Medellín','Cali','Bogotá','Ibagué','Cúcuta','Villavicencio','Pasto','Montería','Sincelejo','Palmira','Bello'];

function fullName(gender) {
  const first = gender === 'M' ? pick(MALE) : pick(FEMALE);
  return { nombres: first, apellidos: `${pick(LAST)} ${pick(LAST)}` };
}

function cedula() {
  const prefix = pick(['10','11','12','13','14','15','16','17','18','19','43','52','53']);
  return prefix + String(randInt(100000, 9999999)).padStart(7, '0');
}

function nit() {
  return String(randInt(800000000, 999999999));
}

function phone() {
  const prefixes = ['300','301','302','303','304','305','310','311','312','313','314','315','316','317','318','319','320','321','322','350'];
  return pick(prefixes) + String(randInt(1000000, 9999999));
}

function email(nombres, apellidos) {
  const n = nombres.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(' ')[0];
  const a = apellidos.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(' ')[0];
  const domains = ['gmail.com','hotmail.com','yahoo.com','outlook.com'];
  const suffix  = randInt(10, 999);
  return `${n}.${a}${suffix}@${pick(domains)}`;
}

function city() { return pick(CITIES); }

module.exports = { fullName, cedula, nit, phone, email, city };
