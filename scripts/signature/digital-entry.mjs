import forge from 'node-forge';
import { SignPdf } from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import * as PDFLib from 'pdf-lib';
import { assertUnsignedDocument } from '../../pdf-sign-core.mjs';
function openIdentity(bytes, password, pem) {
  let key, certificates;
  try {
    if (pem) {
      const text = new TextDecoder().decode(bytes);
      const block = text.match(/-----BEGIN (?:ENCRYPTED PRIVATE KEY|RSA PRIVATE KEY|PRIVATE KEY)-----[\s\S]+?-----END (?:ENCRYPTED PRIVATE KEY|RSA PRIVATE KEY|PRIVATE KEY)-----/);
      if (!block) throw Error('key');
      key = forge.pki.decryptRsaPrivateKey(block[0], password);
      certificates = (text.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) || []).map(c => forge.pki.certificateFromPem(c));
    } else {
      const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(forge.util.createBuffer(bytes)), false, password);
      const bags = oid => p12.getBags({ bagType: oid })[oid] || [];
      key = [...bags(forge.pki.oids.pkcs8ShroudedKeyBag), ...bags(forge.pki.oids.keyBag)].find(b => b.key)?.key;
      certificates = bags(forge.pki.oids.certBag).map(b => b.cert).filter(Boolean);
    }
  } catch { throw Error('Không mở được chứng thư: kiểm tra mật khẩu, định dạng và khóa RSA.'); }
  if (!key?.n || key.n.bitLength() < 2048) throw Error('Cần khóa RSA từ 2048 bit. Chưa hỗ trợ ECDSA hoặc khóa chỉ nằm trong USB Token.');
  const certificate = certificates.find(c => c.publicKey?.n?.compareTo(key.n) === 0 && c.publicKey.e.compareTo(key.e) === 0);
  if (!certificate) throw Error('Không có chứng thư khớp với khóa riêng.');
  const now = new Date();
  if (now < certificate.validity.notBefore || now > certificate.validity.notAfter) throw Error('Chứng thư chưa có hiệu lực hoặc đã hết hạn.');
  const usage = certificate.getExtension('keyUsage');
  if (usage && !usage.digitalSignature && !usage.nonRepudiation) throw Error('Chứng thư không cho phép dùng khóa để ký.');
  const cn = certificate.subject.getField('CN')?.value || certificate.subject.attributes.map(a => a.value).join(', ');
  return { key, certificates, certificate, info: { subject: cn, issuer: certificate.issuer.getField('CN')?.value || 'Không có CN', validFrom: certificate.validity.notBefore.toISOString(), validTo: certificate.validity.notAfter.toISOString(), bits: key.n.bitLength(), serialNumber: certificate.serialNumber } };
}
export function inspectIdentity(bytes, password, pem = false) { return openIdentity(bytes, password, pem).info; }
const utf16 = text => { let s = '\xfe\xff'; for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); s += String.fromCharCode(c >> 8, c & 255); } return s; };
export async function digitalSign(pdf, certificateBytes, password, { pem = false, reason = '', location = '' } = {}) {
  const identity = openIdentity(certificateBytes, password, pem);
  const doc = await PDFLib.PDFDocument.load(pdf.slice());
  assertUnsignedDocument(doc, PDFLib);
  pdflibAddPlaceholder({ pdfDoc: doc, reason: utf16(reason), location: utf16(location), contactInfo: '', name: utf16(identity.info.subject), appName: 'PDF EDITOR', signatureLength: 32768 });
  const prepared = await doc.save({ useObjectStreams: false });
  const localPassword = forge.util.bytesToHex(crypto.getRandomValues(new Uint8Array(24)));
  const normalized = forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(identity.key, [identity.certificate, ...identity.certificates.filter(c => c !== identity.certificate)], localPassword, { algorithm: '3des' })).getBytes();
  const signer = new P12Signer(Buffer.from(normalized, 'binary'), { passphrase: localPassword });
  const signed = await new SignPdf().sign(prepared, signer);
  return { bytes: new Uint8Array(signed), info: identity.info };
}
