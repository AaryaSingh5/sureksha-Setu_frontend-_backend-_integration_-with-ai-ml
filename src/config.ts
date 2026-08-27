/**
 * ==============================================================================
 * 🛡️ SURAKSHA SETU - CENTRALIZED NETWORK & SYSTEM CONFIGURATION
 * ==============================================================================
 * 
 * 📌 TO CHANGE YOUR LAPTOP'S LAN IP (FOR PHYSICAL ANDROID PHONES):
 * Edit the BACKEND_LAN_IP constant below (Line 16).
 * 
 * 💡 ZERO-REBUILD RUNTIME OVERRIDE TIP:
 * If your IP changes frequently during testing, you can also set or change the IP
 * directly in the phone's app at runtime by calling:
 *   localStorage.setItem('sos_api_base_url', 'http://<NEW_IP>:8080/api/v1')
 * or via the `setCustomApiBaseUrl('http://<NEW_IP>:8080/api/v1')` helper function!
 * The app will immediately use the localStorage override without needing an APK rebuild.
 * ==============================================================================
 */

// 🌐 The Primary LAN IPv4 address of the laptop hosting the Express backend server
export const BACKEND_LAN_IP = '10.0.96.233';

// 🔌 Service Ports
export const BACKEND_PORT = 8080;
export const RISK_ENGINE_PORT = 8001;
export const FRONTEND_PORT = 3000;

// 🔗 Derived Default API Base URLs
export const DEFAULT_NATIVE_API_BASE_URL = `http://${BACKEND_LAN_IP}:${BACKEND_PORT}/api/v1`;
export const DEFAULT_RISK_ENGINE_BASE_URL = `http://localhost:${RISK_ENGINE_PORT}`;
