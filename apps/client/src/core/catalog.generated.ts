import m0 from "../../../../modules/autenticacao-basica/client.js";
import m1 from "../../../../modules/busca-scholar/client.js";
import m2 from "../../../../modules/exportacao-basica/client.js";
if(m0.manifesto.id!=="autenticacao-basica")throw new Error("ID de módulo incompatível com configuração: autenticacao-basica");
if(m1.manifesto.id!=="busca-scholar")throw new Error("ID de módulo incompatível com configuração: busca-scholar");
if(m2.manifesto.id!=="exportacao-basica")throw new Error("ID de módulo incompatível com configuração: exportacao-basica");
export const catalog=[m0,m1,m2];
export const options={};
