const TextEncodingPolyfill = require("text-encoding");
import "react-native-url-polyfill/auto";
import "react-native-get-random-values";
import "message-port-polyfill";

const applyGlobalPolyfills = () => {
    console.log("🔧 Applying global polyfills for NWC...");
    Object.assign(global, {
        TextEncoder: TextEncodingPolyfill.TextEncoder,
        TextDecoder: TextEncodingPolyfill.TextDecoder,
    });
    console.log("✅ Global polyfills applied successfully");
};

applyGlobalPolyfills();
