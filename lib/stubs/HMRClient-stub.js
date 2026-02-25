/**
 * HMR Client stub for web
 * Bypasses Expo's HMR client that fails on web.
 * Must export a constructor so `new MetroHMRClient.default()` works.
 */

const noop = () => {};
const noopFalse = () => false;
const noopTrue = () => true;

function HMRClientClass() {}

HMRClientClass.prototype.setup = noop;
HMRClientClass.prototype.enable = noop;
HMRClientClass.prototype.disable = noop;
HMRClientClass.prototype.registerBundle = noop;
HMRClientClass.prototype.log = noop;
HMRClientClass.prototype.send = noop;
HMRClientClass.prototype.on = noop;
HMRClientClass.prototype.off = noop;
HMRClientClass.prototype.emit = noop;
HMRClientClass.prototype.removeListener = noop;
HMRClientClass.prototype.hasPendingUpdates = noopFalse;
HMRClientClass.prototype.clearPendingUpdates = noop;

// Export as default (constructor)
export default HMRClientClass;

// Support CommonJS require - default must be a constructor
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HMRClientClass;
  module.exports.default = HMRClientClass;
}
