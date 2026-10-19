import { inspectIdentity, digitalSign } from './vendor/signature/digital.mjs';
self.onmessage = async ({ data }) => {
  try {
    const result = data.action === 'inspect' ? { info: inspectIdentity(data.certificate, data.password, data.options.pem) } : await digitalSign(data.pdf, data.certificate, data.password, data.options);
    self.postMessage({ ok: true, ...result }, result.bytes ? [result.bytes.buffer] : []);
  } catch (error) {
    self.postMessage({ ok: false, error: error.message || 'Không ký được PDF bằng chứng thư đã chọn.' });
  } finally {
    data.password = ''; data.certificate?.fill(0); self.close();
  }
};
