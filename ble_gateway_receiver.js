#!/usr/bin/env node

/**
 * ==============================================================================
 * 💻 SURAKSHA SETU - LAPTOP BLE GATEWAY RECEIVER
 * ==============================================================================
 * Runs on the internet-connected Laptop Gateway to ingest incoming BLE SOS packets
 * from Android Phone B (or Phone A) and upload them to the Suraksha Setu backend.
 * 
 * Flow:
 *   Phone A (Tourist, Offline)
 *        │ REAL BLE
 *        ▼
 *   Phone B (Relay, Offline)
 *        │ REAL BLE
 *        ▼
 *   Laptop Gateway (Running this receiver with Internet ON)
 *        │ HTTP POST /api/v1/sos
 *        ▼
 *   Backend / Authority Dashboard
 * ==============================================================================
 */

import http from 'http';
import readline from 'readline';

const BACKEND_URL = 'http://localhost:8080/api/v1/sos';
const BLE_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const BLE_CHAR_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

console.log('\n===============================================================================');
console.log('💻 SURAKSHA SETU: LAPTOP BLE GATEWAY UPLINK ACTIVE');
console.log('===============================================================================');
console.log(`Backend Target: ${BACKEND_URL}`);
console.log(`Listening for incoming BLE SOS Packets on Service: ${BLE_SERVICE_UUID}\n`);

async function forwardSOSToBackend(packet) {
  console.log(`\n[GATEWAY] 📥 Received BLE SOS Packet #${packet.sos_id || packet.packet_id}`);
  console.log(`          Path: ${(packet.hop_path || []).join(' ➔ ') || packet.origin_device_id}`);
  console.log(`          Hop Count: ${packet.hop_count}/${packet.max_hops || 5}`);
  console.log(`          Location: Lat ${packet.latitude}, Lng ${packet.longitude}`);

  const payload = {
    tourist_id: packet.tourist_id || 'TR-88219',
    touristName: packet.touristName || 'Elena Rostova',
    latitude: packet.latitude,
    longitude: packet.longitude,
    description: packet.description || 'Emergency SOS Alert',
    severity: packet.severity || 'HIGH',
    trigger_source: 'BLE_MESH_RELAY',
    client_generated_id: packet.sos_id,
    hop_count: packet.hop_count,
    hop_path: packet.hop_path,
    origin_device_id: packet.origin_device_id
  };

  const data = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = http.request(
      BACKEND_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            console.log(`[GATEWAY] ✅ Successfully forwarded to Backend!`);
            console.log(`          Incident ID: ${json.incident_id || json.sos_id}`);
            console.log(`          Status: ${json.status || 'New'} | Code: ${res.statusCode}\n`);
            resolve(json);
          } catch {
            console.log(`[GATEWAY] Response: ${body}`);
            resolve({ raw: body });
          }
        });
      }
    );

    req.on('error', (err) => {
      console.error(`[GATEWAY] ❌ Backend upload error:`, err.message);
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

// ----------------------------------------------------------------------
// Interactive Ingestion & Web BLE Bridge Mode
// ----------------------------------------------------------------------

console.log('Instructions:');
console.log('1. On Android Phone A (Tourist, Internet OFF): Trigger SOS in Suraksha Setu App.');
console.log('2. Android Phone B (Relay, Internet OFF) receives via BLE and forwards it.');
console.log('3. You can paste an incoming BLE JSON packet below, or run Web Bluetooth in browser.\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.setPrompt('BLE-Gateway> (Paste JSON packet or type "test" to simulate) ');
rl.prompt();

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) {
    rl.prompt();
    return;
  }

  if (trimmed === 'test') {
    const samplePacket = {
      protocol_version: 'SURAKSHA_BLE_v1',
      packet_id: `BLE-PKT-${Date.now()}`,
      sos_id: `SOS-${Math.floor(1000 + Math.random() * 9000)}`,
      tourist_id: 'TR-88219',
      triggered_at: new Date().toISOString(),
      latitude: 32.2432,
      longitude: 77.1892,
      description: 'Simulated 2-Hop BLE SOS Packet from Solang Valley',
      severity: 'CRITICAL',
      hop_count: 2,
      max_hops: 5,
      hop_path: ['DEV-PHONE-A-101', 'DEV-PHONE-B-102', 'LAPTOP-GATEWAY'],
      origin_device_id: 'DEV-PHONE-A-101',
      relay_timestamp: new Date().toISOString(),
      packet_type: 'SOS_ALERT'
    };
    await forwardSOSToBackend(samplePacket);
  } else {
    try {
      const parsed = JSON.parse(trimmed);
      await forwardSOSToBackend(parsed);
    } catch (e) {
      console.log('Invalid JSON packet string. Please paste valid JSON.');
    }
  }

  rl.prompt();
});
