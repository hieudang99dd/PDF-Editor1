// Test certificates only, generated ephemerally and never committed or sent to users.
import forge from 'node-forge';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const out=fileURLToPath(new URL('../../test-results/signature/',import.meta.url));await mkdir(out,{recursive:true});
const keys=forge.pki.rsa.generateKeyPair(2048);
async function certificate(name,expired=false) {
 const c=forge.pki.createCertificate();c.publicKey=keys.publicKey;c.serialNumber='01';c.validity.notBefore=new Date(Date.now()-86400000*2);c.validity.notAfter=new Date(Date.now()+(expired?-86400000:86400000*30));
 c.setSubject([{name:'commonName',value:'PDF Editor QA Certificate'}]);c.setIssuer(c.subject.attributes);c.setExtensions([{name:'basicConstraints',cA:false},{name:'keyUsage',digitalSignature:true,nonRepudiation:true}]);c.sign(keys.privateKey,forge.md.sha256.create());
 const p12=forge.pkcs12.toPkcs12Asn1(keys.privateKey,[c],'test-password',{algorithm:'3des'});
 await writeFile(out+name+'.p12',Buffer.from(forge.asn1.toDer(p12).getBytes(),'binary'));
 if(!expired){await writeFile(out+'certificate.pem',forge.pki.certificateToPem(c));await writeFile(out+'identity.pem',forge.pki.certificateToPem(c)+forge.pki.encryptRsaPrivateKey(keys.privateKey,'test-password',{algorithm:'aes256'}));}
}
await certificate('valid');await certificate('expired',true);console.log('Generated local-only QA identities');
