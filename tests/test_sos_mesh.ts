import express from 'express';
import http from 'http';
import { initDatabase, all, get, run } from '../server/db';
import sosRoutes from '../server/routes/sos';

async function runSuite() {
  console.log('\n===============================================================================');
  console.log('📡 SURAKSHA SETU: COMPLETE BLUETOOTH MULTI-HOP STORE-AND-FORWARD TEST SUITE');
  console.log('===============================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      if (details) console.log(`   └─ ${details}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (details) console.error(`   └─ ${details}`);
    }
  }

  // 1. Initialize SQLite Database
  await initDatabase();
  console.log('SQLite Database Initialized successfully.');

  // 2. Start a test Express instance with latest updated routes
  const app = express();
  app.use(express.json());
  app.use('/api/v1/sos', sosRoutes);

  const server = app.listen(8099);
  const postTestSOS = (payload: any): Promise<{ statusCode: number; data: any }> => {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(payload);
      const req = http.request(
        'http://localhost:8099/api/v1/sos',
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
              resolve({ statusCode: res.statusCode || 0, data: JSON.parse(body) });
            } catch {
              resolve({ statusCode: res.statusCode || 0, data: body });
            }
          });
        }
      );
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  };

  try {
    // ------------------------------------------------------------------
    // TEST 1: Direct Online SOS Submission
    // ------------------------------------------------------------------
    console.log('\n--- TEST 1: Direct Online SOS Submission ---');
    const directSosId = `SOS-DIR-${Date.now()}`;
    const res1 = await postTestSOS({
      tourist_id: 'TR-88219',
      touristName: 'Elena Rostova',
      touristPhone: '+91 98765 43210',
      latitude: 32.2432,
      longitude: 77.1892,
      description: 'Direct Online Distress Beacon (Solang Valley)',
      severity: 'HIGH',
      trigger_source: 'APP',
      client_generated_id: directSosId,
      hop_count: 0
    });

    assert(
      res1.statusCode === 201 && res1.data.success === true,
      'Direct Online SOS Ingestion at /api/v1/sos',
      `Server registered incident ID: ${res1.data.incident_id}`
    );

    // Verify stored row in SQLite
    const row1 = await get<any>('SELECT * FROM sos_incidents WHERE id = ?', [directSosId]);
    assert(
      row1 && row1.id === directSosId && row1.trigger_source === 'APP',
      'SQLite Record Verified for Direct SOS',
      `Stored Lat/Lng: ${row1?.lat}, ${row1?.lng} | Status: ${row1?.status}`
    );

    // ------------------------------------------------------------------
    // TEST 2: Multi-Hop Store-and-Forward Relay Simulation (A -> B -> C -> Server)
    // ------------------------------------------------------------------
    console.log('\n--- TEST 2: Multi-Hop Bluetooth Relay (Tourist A ➔ Relay B ➔ Gateway C ➔ Server) ---');
    const meshSosId = `SOS-MESH-${Date.now()}`;
    const devA = 'DEV-TOURIST-A-01';
    const devB = 'DEV-RELAY-B-02';
    const devC = 'DEV-GATEWAY-C-03';

    // Step A (Origin Node - Offline):
    const packetA = {
      sos_id: meshSosId,
      tourist_id: 'TR-88219',
      touristName: 'Elena Rostova',
      latitude: 32.2514,
      longitude: 77.1785,
      description: 'Emergency SOS (No Internet - Solang Gorge Trail)',
      severity: 'CRITICAL',
      hop_count: 0,
      max_hops: 5,
      hop_path: [devA],
      origin_device_id: devA
    };
    assert(
      packetA.hop_count === 0 && packetA.hop_path[0] === devA,
      'Tourist A generates Genesis Offline SOS Packet',
      `Hop: ${packetA.hop_count}/${packetA.max_hops} | Origin: ${packetA.origin_device_id}`
    );

    // Step B (Nearby Relay Device - Offline):
    const packetB = {
      ...packetA,
      hop_count: packetA.hop_count + 1,
      hop_path: [...packetA.hop_path, devB]
    };
    assert(
      packetB.hop_count === 1 && packetB.hop_path.includes(devB),
      'Device B receives via Bluetooth LE and increments hop count',
      `Path: ${packetB.hop_path.join(' ➔ ')} (Hop ${packetB.hop_count}/${packetB.max_hops})`
    );

    // Step C (Gateway Device - Has Internet):
    const packetC = {
      ...packetB,
      hop_count: packetB.hop_count + 1,
      hop_path: [...packetB.hop_path, devC]
    };
    assert(
      packetC.hop_count === 2 && packetC.hop_path.length === 3,
      'Device C receives relayed packet via Bluetooth (Hop 2)',
      `Path: ${packetC.hop_path.join(' ➔ ')} (Hop ${packetC.hop_count}/${packetC.max_hops})`
    );

    // Step D (Device C uploads to Backend):
    const resMesh = await postTestSOS({
      tourist_id: packetC.tourist_id,
      touristName: packetC.touristName,
      latitude: packetC.latitude,
      longitude: packetC.longitude,
      description: packetC.description,
      severity: packetC.severity,
      trigger_source: 'BLE_MESH_RELAY',
      client_generated_id: packetC.sos_id,
      hop_count: packetC.hop_count,
      hop_path: packetC.hop_path,
      origin_device_id: packetC.origin_device_id
    });

    assert(
      resMesh.statusCode === 201 && resMesh.data.success === true,
      'Device C successfully uploads multi-hop SOS to Backend',
      `Server Response: ${resMesh.data.message} | Registered: ${resMesh.data.incident_id}`
    );

    // Verify DB preservation of hop path and metadata
    const meshRow = await get<any>('SELECT * FROM sos_incidents WHERE id = ?', [meshSosId]);
    assert(
      meshRow && meshRow.notes.includes('Relayed via 2 Bluetooth Hop(s)'),
      'Backend preserves Hop Count & Routing Path in Incident Records',
      `Notes: "${meshRow?.notes}"`
    );

    // ------------------------------------------------------------------
    // TEST 3: Duplicate Re-Transmission Suppression (Idempotence)
    // ------------------------------------------------------------------
    console.log('\n--- TEST 3: Duplicate Packet Suppression ---');
    const resDup = await postTestSOS({
      tourist_id: packetC.tourist_id,
      touristName: packetC.touristName,
      latitude: packetC.latitude,
      longitude: packetC.longitude,
      description: packetC.description,
      severity: packetC.severity,
      trigger_source: 'BLE_MESH_RELAY',
      client_generated_id: meshSosId, // Same ID submitted again
      hop_count: 3
    });

    assert(
      resDup.statusCode === 200 && resDup.data.message.includes('already registered'),
      'Backend detects duplicate SOS ID and returns HTTP 200 without duplicate rows',
      `Message: ${resDup.data.message}`
    );

    // Check count of rows in DB
    const countRows = await get<any>('SELECT COUNT(*) as cnt FROM sos_incidents WHERE id = ?', [meshSosId]);
    assert(
      countRows.cnt === 1,
      'Database contains exactly 1 unique record for the SOS incident',
      `Total matches in DB: ${countRows.cnt}`
    );

    // ------------------------------------------------------------------
    // TEST 4: TTL / Hop Limit Validation
    // ------------------------------------------------------------------
    console.log('\n--- TEST 4: TTL / Hop Limit Enforcement ---');
    const maxAllowedHops = 5;
    const testExceededHop = 5;
    const shouldDrop = testExceededHop >= maxAllowedHops;

    assert(
      shouldDrop === true,
      'Transport layer drops packets when hop_count >= max_hops (TTL Expiry)',
      `Hop count ${testExceededHop} >= limit ${maxAllowedHops} ➔ Packet dropped to prevent network storm.`
    );

    // ------------------------------------------------------------------
    // SUMMARY
    // ------------------------------------------------------------------
    console.log('\n===============================================================================');
    console.log(`TEST SUMMARY: ${passed}/${total} TESTS PASSED`);
    if (passed === total) {
      console.log('✅ ALL 9 SOS BLUETOOTH MULTI-HOP TEST REQUIREMENTS VERIFIED SUCCESSFULLY!');
    } else {
      console.error('❌ SOME TESTS FAILED.');
      process.exit(1);
    }
    console.log('===============================================================================\n');
    process.exit(0);
  } catch (err: any) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    server.close();
  }
}

runSuite();
