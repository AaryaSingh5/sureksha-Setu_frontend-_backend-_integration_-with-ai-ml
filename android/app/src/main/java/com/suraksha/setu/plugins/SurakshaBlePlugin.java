package com.suraksha.setu.plugins;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattServer;
import android.bluetooth.BluetoothGattServerCallback;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;
import android.util.Log;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONException;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@CapacitorPlugin(
    name = "SurakshaBlePlugin",
    permissions = {
        @Permission(
            alias = "bluetooth",
            strings = {
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_ADVERTISE,
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.ACCESS_FINE_LOCATION
            }
        )
    }
)
public class SurakshaBlePlugin extends Plugin {

    private static final String TAG = "SurakshaBLE";

    public static final UUID SERVICE_UUID = UUID.fromString("0000ffe0-0000-1000-8000-00805f9b34fb");
    public static final UUID CHAR_UUID = UUID.fromString("0000ffe1-0000-1000-8000-00805f9b34fb");

    private BluetoothAdapter bluetoothAdapter;
    private BluetoothManager bluetoothManager;
    private BluetoothLeAdvertiser bluetoothLeAdvertiser;
    private BluetoothGattServer bluetoothGattServer;
    private BluetoothLeScanner bluetoothLeScanner;

    private boolean isAdvertising = false;
    private boolean isContinuousScanning = false;
    private boolean isTransientScanning = false;
    private ScanCallback continuousScanCallback = null;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    public void load() {
        super.load();
        Context context = getContext();
        bluetoothManager = (Context) context != null ? (BluetoothManager) context.getSystemService(Context.BLUETOOTH_SERVICE) : null;
        if (bluetoothManager != null) {
            bluetoothAdapter = bluetoothManager.getAdapter();
        }
        Log.i(TAG, "Suraksha BLE Native Plugin Loaded.");
    }

    private boolean hasBleRequiredPermissions() {
        Context ctx = getContext();
        if (ctx == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ActivityCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED &&
                   ActivityCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_ADVERTISE) == PackageManager.PERMISSION_GRANTED &&
                   ActivityCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
        } else {
            return ActivityCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        }
    }

    // =========================================================================
    // 1. BLE STATUS & PERMISSIONS API
    // =========================================================================

    @PluginMethod
    public void getBleStatus(PluginCall call) {
        JSObject ret = new JSObject();
        boolean supported = bluetoothAdapter != null;
        boolean enabled = supported && bluetoothAdapter.isEnabled();
        ret.put("supported", supported);
        ret.put("enabled", enabled);
        ret.put("isAdvertising", isAdvertising);
        ret.put("isScanning", isContinuousScanning || isTransientScanning);
        ret.put("hasPermissions", hasBleRequiredPermissions());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestBlePermissions(PluginCall call) {
        if (hasBleRequiredPermissions()) {
            JSObject res = new JSObject();
            res.put("granted", true);
            call.resolve(res);
            return;
        }
        requestPermissionForAlias("bluetooth", call, "permissionCallback");
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        JSObject res = new JSObject();
        res.put("granted", hasBleRequiredPermissions());
        call.resolve(res);
    }

    // =========================================================================
    // 1B. CONTINUOUS BLE SCANNER (RELAY DUAL-ROLE MODE)
    // =========================================================================

    @PluginMethod
    public void startContinuousScan(PluginCall call) {
        if (!hasBleRequiredPermissions()) {
            call.reject("Bluetooth permissions not granted.");
            return;
        }
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
            call.reject("Bluetooth is not enabled on this device.");
            return;
        }

        bluetoothLeScanner = bluetoothAdapter.getBluetoothLeScanner();
        if (bluetoothLeScanner == null) {
            call.reject("Bluetooth LE Scanner not available.");
            return;
        }

        if (isContinuousScanning && continuousScanCallback != null) {
            Log.i(TAG, "[BLE-SCAN] Continuous RELAY scanner already active.");
            JSObject ret = new JSObject();
            ret.put("scanning", true);
            call.resolve(ret);
            return;
        }

        Log.i(TAG, "[BLE-SCAN] Starting continuous RELAY scanner");

        List<ScanFilter> filters = new ArrayList<>();
        filters.add(new ScanFilter.Builder().setServiceUuid(new ParcelUuid(SERVICE_UUID)).build());

        ScanSettings settings = new ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build();

        continuousScanCallback = new ScanCallback() {
            @Override
            public void onScanResult(int callbackType, ScanResult result) {
                BluetoothDevice device = result.getDevice();
                if (device != null) {
                    try {
                        String devName = device.getName() != null ? device.getName() : "Suraksha Node";
                        Log.i(TAG, "[BLE-SCAN] Device discovered:\naddress=" + device.getAddress() + "\nname=" + devName + "\nrssi=" + result.getRssi());
                    } catch (SecurityException ignored) {}
                }
            }

            @Override
            public void onScanFailed(int errorCode) {
                Log.e(TAG, "[BLE-SCAN] Scan failed:\nerrorCode=" + errorCode);
                isContinuousScanning = false;
            }
        };

        try {
            bluetoothLeScanner.startScan(filters, settings, continuousScanCallback);
            isContinuousScanning = true;
            Log.i(TAG, "[BLE-SCAN] Continuous RELAY scanner started");
            JSObject ret = new JSObject();
            ret.put("scanning", true);
            call.resolve(ret);
        } catch (SecurityException se) {
            isContinuousScanning = false;
            call.reject("Permission error starting continuous scan: " + se.getMessage());
        } catch (Exception e) {
            isContinuousScanning = false;
            call.reject("Failed to start continuous scan: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopContinuousScan(PluginCall call) {
        try {
            if (bluetoothLeScanner != null && continuousScanCallback != null && isContinuousScanning) {
                Log.i(TAG, "[BLE-SCAN] Stopping continuous RELAY scanner");
                try {
                    bluetoothLeScanner.stopScan(continuousScanCallback);
                } catch (SecurityException ignored) {}
            }
            isContinuousScanning = false;
            continuousScanCallback = null;
            JSObject ret = new JSObject();
            ret.put("scanning", false);
            if (call != null) {
                call.resolve(ret);
            }
            Log.i(TAG, "[BLE-SCAN] Continuous RELAY scanner stopped");
            call.resolve(ret);
            Log.i(TAG, "[BLE-SCAN] Continuous RELAY background scanner stopped.");
        } catch (SecurityException se) {
            call.reject("Permission error stopping continuous scan: " + se.getMessage());
        } catch (Exception e) {
            call.reject("Failed to stop continuous scan: " + e.getMessage());
        }
    }

    // =========================================================================
    // 3. BLE PERIPHERAL / GATT SERVER & ADVERTISER
    // =========================================================================

    @PluginMethod
    public void startAdvertising(PluginCall call) {
        if (!hasBleRequiredPermissions()) {
            call.reject("Bluetooth permissions not granted.");
            return;
        }
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
            call.reject("Bluetooth is turned off.");
            return;
        }

        bluetoothLeAdvertiser = bluetoothAdapter.getBluetoothLeAdvertiser();
        if (bluetoothLeAdvertiser == null) {
            call.reject("BLE Advertising is not supported on this hardware.");
            return;
        }

        BluetoothManager bluetoothManager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        if (bluetoothManager == null) {
            call.reject("BluetoothManager is not available.");
            return;
        }

        try {
            // 1. Setup GATT Server
            if (bluetoothGattServer != null) {
                try {
                    bluetoothGattServer.close();
                } catch (Exception ignored) {}
                bluetoothGattServer = null;
            }

            bluetoothGattServer = bluetoothManager.openGattServer(getContext(), gattServerCallback);
            BluetoothGattService service = new BluetoothGattService(SERVICE_UUID, BluetoothGattService.SERVICE_TYPE_PRIMARY);
            BluetoothGattCharacteristic characteristic = new BluetoothGattCharacteristic(
                CHAR_UUID,
                BluetoothGattCharacteristic.PROPERTY_WRITE | BluetoothGattCharacteristic.PROPERTY_READ | BluetoothGattCharacteristic.PROPERTY_NOTIFY,
                BluetoothGattCharacteristic.PERMISSION_WRITE | BluetoothGattCharacteristic.PERMISSION_READ
            );
            service.addCharacteristic(characteristic);
            bluetoothGattServer.addService(service);
            Log.i(TAG, "[BLE-ADV] GATT server started on Service UUID: " + SERVICE_UUID);

            // 2. Setup Advertise Settings & Data
            AdvertiseSettings settings = new AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
                .setConnectable(true)
                .setTimeout(0)
                .build();

            AdvertiseData data = new AdvertiseData.Builder()
                .setIncludeDeviceName(false)
                .setIncludeTxPowerLevel(false)
                .addServiceUuid(new ParcelUuid(SERVICE_UUID))
                .build();

            AdvertiseData scanResponse = new AdvertiseData.Builder()
                .setIncludeDeviceName(true)
                .build();

            bluetoothLeAdvertiser.startAdvertising(settings, data, scanResponse, advertiseCallback);
            isAdvertising = true;

            JSObject ret = new JSObject();
            ret.put("advertising", true);
            ret.put("serviceUuid", SERVICE_UUID.toString());
            call.resolve(ret);
            Log.i(TAG, "[BLE-ADV] Advertising request dispatched.");
        } catch (SecurityException se) {
            call.reject("Permission error starting advertiser: " + se.getMessage());
        } catch (Exception e) {
            call.reject("Failed to start BLE advertising: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopAdvertising(PluginCall call) {
        try {
            if (bluetoothLeAdvertiser != null) {
                try {
                    bluetoothLeAdvertiser.stopAdvertising(advertiseCallback);
                } catch (Exception ignored) {}
            }
            isAdvertising = false;
            if (bluetoothGattServer != null) {
                try {
                    bluetoothGattServer.close();
                } catch (Exception ignored) {}
                bluetoothGattServer = null;
            }
            JSObject ret = new JSObject();
            ret.put("advertising", false);
            call.resolve(ret);
            Log.i(TAG, "[BLE-ADV] Peripheral Advertising stopped.");
        } catch (SecurityException se) {
            call.reject("Permission error: " + se.getMessage());
        } catch (Exception e) {
            call.reject("Error stopping BLE advertising: " + e.getMessage());
        }
    }

    private final AdvertiseCallback advertiseCallback = new AdvertiseCallback() {
        @Override
        public void onStartSuccess(AdvertiseSettings settingsInEffect) {
            super.onStartSuccess(settingsInEffect);
            isAdvertising = true;
            Log.i(TAG, "[BLE-ADV] Advertising started successfully.");
        }

        @Override
        public void onStartFailure(int errorCode) {
            super.onStartFailure(errorCode);
            if (errorCode == AdvertiseCallback.ADVERTISE_FAILED_ALREADY_STARTED) {
                isAdvertising = true;
                Log.i(TAG, "[BLE-ADV] Advertising already started/active.");
            } else {
                isAdvertising = false;
                Log.e(TAG, "[BLE-ADV] Advertising failed: Error code " + errorCode);
            }
        }
    };

    private final java.io.ByteArrayOutputStream incomingChunkBuffer = new java.io.ByteArrayOutputStream();
    private Runnable chunkTimeoutRunnable = null;

    private final BluetoothGattServerCallback gattServerCallback = new BluetoothGattServerCallback() {
        @Override
        public void onConnectionStateChange(BluetoothDevice device, int status, int newState) {
            super.onConnectionStateChange(device, status, newState);
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                Log.i(TAG, "[BLE-GATT] Incoming Tourist connection from: " + device.getAddress());
                Log.i(TAG, "[BLE-GATT] Tourist connected");
                incomingChunkBuffer.reset();
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                Log.i(TAG, "[BLE-GATT] Tourist disconnected: " + device.getAddress());
                incomingChunkBuffer.reset();
            }
        }

        @Override
        public void onCharacteristicWriteRequest(
            BluetoothDevice device,
            int requestId,
            BluetoothGattCharacteristic characteristic,
            boolean preparedWrite,
            boolean responseNeeded,
            int offset,
            byte[] value
        ) {
            super.onCharacteristicWriteRequest(device, requestId, characteristic, preparedWrite, responseNeeded, offset, value);

            if (CHAR_UUID.equals(characteristic.getUuid()) && value != null) {
                Log.i(TAG, "[BLE-SOS-RECEIVED] SOS characteristic write received (" + value.length + " bytes, prepared=" + preparedWrite + ", offset=" + offset + ")");

                if (responseNeeded && bluetoothGattServer != null) {
                    try {
                        bluetoothGattServer.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value);
                    } catch (SecurityException ignored) {}
                }

                // Append incoming bytes to chunk buffer
                try {
                    incomingChunkBuffer.write(value);
                } catch (Exception ignored) {}

                // Reset timeout on every received chunk
                if (chunkTimeoutRunnable != null) {
                    mainHandler.removeCallbacks(chunkTimeoutRunnable);
                }
                chunkTimeoutRunnable = () -> incomingChunkBuffer.reset();
                mainHandler.postDelayed(chunkTimeoutRunnable, 4000);

                // Attempt to parse complete JSON packet
                try {
                    String candidate = new String(incomingChunkBuffer.toByteArray(), StandardCharsets.UTF_8).trim();
                    if (candidate.startsWith("{") && candidate.endsWith("}")) {
                        new JSONObject(candidate); // Validation parse
                        mainHandler.removeCallbacks(chunkTimeoutRunnable);
                        incomingChunkBuffer.reset();
                        processIncomingSosPayload(candidate);
                    }
                } catch (JSONException e) {
                    // Packet is still incomplete (more chunks pending)
                    Log.i(TAG, "[BLE-SOS-RECEIVED] Buffered chunk (" + incomingChunkBuffer.size() + " bytes total so far), waiting for remaining chunks...");
                }
            }
        }

        @Override
        public void onExecuteWrite(BluetoothDevice device, int requestId, boolean execute) {
            super.onExecuteWrite(device, requestId, execute);
            if (execute && incomingChunkBuffer.size() > 0) {
                String payload = new String(incomingChunkBuffer.toByteArray(), StandardCharsets.UTF_8);
                incomingChunkBuffer.reset();
                processIncomingSosPayload(payload);
            } else {
                incomingChunkBuffer.reset();
            }
            if (bluetoothGattServer != null) {
                try {
                    bluetoothGattServer.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, null);
                } catch (SecurityException ignored) {}
            }
        }
    };

    private void processIncomingSosPayload(String payload) {
        Log.i(TAG, "[BLE-SOS-RECEIVED] SOS packet reconstructed: " + payload);
        mainHandler.post(() -> {
            try {
                JSONObject json = new JSONObject(payload);
                String touristId = json.optString("tourist_id", "TR-88219");
                String sosId = json.optString("sos_id", "SOS-" + System.currentTimeMillis());
                double lat = json.optDouble("latitude", 0.0);
                double lng = json.optDouble("longitude", 0.0);

                Log.i(TAG, "[BLE-SOS-RECEIVED] Tourist ID: " + touristId);
                Log.i(TAG, "[BLE-SOS-RECEIVED] Incident ID: " + sosId);
                Log.i(TAG, "[BLE-SOS-RECEIVED] GPS: " + lat + ", " + lng);

                JSObject eventData = JSObject.fromJSONObject(json);
                notifyListeners("sosRelayPacketReceived", eventData);
                Log.i(TAG, "[BLE-GATEWAY] Dispatched sosRelayPacketReceived event to web layer.");
            } catch (Exception e) {
                Log.e(TAG, "Error parsing incoming JSON packet: " + e.getMessage());
            }
        });
    }

    // =========================================================================
    // 3. BLE CENTRAL / SCANNER & SENDER
    // =========================================================================

    @PluginMethod
    public void transmitBlePacket(PluginCall call) {
        if (!hasBleRequiredPermissions()) {
            call.reject("Bluetooth permissions not granted.");
            return;
        }
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
            call.reject("Bluetooth is turned off.");
            return;
        }

        JSObject packetObj = call.getObject("packet");
        if (packetObj == null) {
            call.reject("Missing 'packet' parameter.");
            return;
        }

        final String jsonPayload = packetObj.toString();
        Log.i(TAG, "[BLE] transmitBlePacket called for packet: " + jsonPayload);

        bluetoothLeScanner = bluetoothAdapter.getBluetoothLeScanner();
        if (bluetoothLeScanner == null) {
            call.reject("Bluetooth LE Scanner not available.");
            return;
        }

        Log.i(TAG, "[BLE-SCAN] Scanning for Suraksha Gateway (Service: " + SERVICE_UUID + ")");
        isTransientScanning = true;

        List<ScanFilter> filters = new ArrayList<>();
        // Open filter to prevent hardware chipset 128-bit UUID filtering bugs across Android vendors

        ScanSettings settings = new ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build();

        final Runnable timeoutRunnable = () -> {
            if (isTransientScanning) {
                try {
                    bluetoothLeScanner.stopScan(new ScanCallback() {});
                } catch (SecurityException ignored) {}
                isTransientScanning = false;
                Log.w(TAG, "[BLE-SCAN] No Gateway/Relay found within scan timeout window (9s).");
                JSObject res = new JSObject();
                res.put("success", false);
                res.put("message", "No nearby Suraksha Setu BLE Gateway or Relay nodes found in range.");
                call.resolve(res);
            }
        };

        // 9 second discovery timeout
        mainHandler.postDelayed(timeoutRunnable, 9000);

        try {
            bluetoothLeScanner.startScan(filters, settings, new ScanCallback() {
                @Override
                public void onScanResult(int callbackType, ScanResult result) {
                    BluetoothDevice device = result.getDevice();
                    if (device == null || !isTransientScanning) return;

                    // Software-level Service UUID & Name verification
                    boolean isMatch = false;
                    android.bluetooth.le.ScanRecord scanRecord = result.getScanRecord();
                    if (scanRecord != null) {
                        List<ParcelUuid> uuids = scanRecord.getServiceUuids();
                        if (uuids != null) {
                            for (ParcelUuid u : uuids) {
                                if (SERVICE_UUID.equals(u.getUuid())) {
                                    isMatch = true;
                                    break;
                                }
                            }
                        }
                    }

                    String devName = null;
                    try {
                        devName = device.getName();
                    } catch (SecurityException ignored) {}

                    if (devName != null && (devName.toLowerCase().contains("suraksha") || devName.toLowerCase().contains("gateway") || devName.toLowerCase().contains("relay"))) {
                        isMatch = true;
                    }

                    if (isMatch) {
                        isTransientScanning = false;
                        mainHandler.removeCallbacks(timeoutRunnable);
                        try {
                            bluetoothLeScanner.stopScan(this);
                        } catch (SecurityException ignored) {}

                        Log.i(TAG, "[BLE-DISCOVERY] Gateway discovered: " + device.getAddress() + " (" + (devName != null ? devName : "Suraksha Gateway") + ")");
                        connectAndSend(device, jsonPayload, call);
                    }
                }

                @Override
                public void onScanFailed(int errorCode) {
                    isTransientScanning = false;
                    mainHandler.removeCallbacks(timeoutRunnable);
                    Log.e(TAG, "[BLE-SCAN] Scan failed with error code: " + errorCode);
                    call.reject("BLE Scan failed with error code: " + errorCode);
                }
            });
        } catch (SecurityException se) {
            mainHandler.removeCallbacks(timeoutRunnable);
            isTransientScanning = false;
            call.reject("Permission error scanning BLE: " + se.getMessage());
        }
    }

    private void connectAndSend(BluetoothDevice device, String payload, PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context is null.");
            return;
        }

        Log.i(TAG, "[BLE-GATT] Connecting to Gateway: " + device.getAddress());

        final byte[] allPayloadBytes = payload.getBytes(StandardCharsets.UTF_8);

        try {
            device.connectGatt(context, false, new BluetoothGattCallback() {
                private int negotiatedMtu = 23;
                private boolean servicesDiscoveryTriggered = false;
                private final List<byte[]> chunks = new ArrayList<>();
                private int currentChunkIndex = 0;
                private BluetoothGattCharacteristic targetChar = null;

                @Override
                public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
                    if (newState == BluetoothProfile.STATE_CONNECTED) {
                        Log.i(TAG, "[BLE-GATT] Connected to Gateway: " + device.getAddress());
                        try {
                            Log.i(TAG, "[BLE-MTU] Requesting 512 MTU from Gateway...");
                            boolean mtuRequested = gatt.requestMtu(512);
                            if (!mtuRequested) {
                                Log.w(TAG, "[BLE-MTU] requestMtu returned false, proceeding to service discovery with default MTU.");
                                triggerServiceDiscovery(gatt);
                            } else {
                                // Safety timer: if onMtuChanged is not called within 1.2s, proceed with discovery
                                mainHandler.postDelayed(() -> {
                                    if (!servicesDiscoveryTriggered) {
                                        Log.w(TAG, "[BLE-MTU] onMtuChanged timed out, discovering services with MTU=" + negotiatedMtu);
                                        triggerServiceDiscovery(gatt);
                                    }
                                }, 1200);
                            }
                        } catch (SecurityException se) {
                            call.reject("Permission error requesting MTU: " + se.getMessage());
                        }
                    } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                        Log.i(TAG, "[BLE-GATT] Disconnected from GATT server " + device.getAddress());
                        try {
                            gatt.close();
                        } catch (SecurityException ignored) {}
                    }
                }

                @Override
                public void onMtuChanged(BluetoothGatt gatt, int mtu, int status) {
                    super.onMtuChanged(gatt, mtu, status);
                    if (status == BluetoothGatt.GATT_SUCCESS) {
                        negotiatedMtu = mtu;
                        Log.i(TAG, "[BLE-MTU] Negotiated MTU: " + mtu + " (status: SUCCESS)");
                    } else {
                        negotiatedMtu = 23;
                        Log.w(TAG, "[BLE-MTU] MTU negotiation failed with status: " + status + ". Falling back to MTU: 23");
                    }
                    triggerServiceDiscovery(gatt);
                }

                private synchronized void triggerServiceDiscovery(BluetoothGatt gatt) {
                    if (servicesDiscoveryTriggered) return;
                    servicesDiscoveryTriggered = true;
                    try {
                        Log.i(TAG, "[BLE-GATT] Discovering GATT services...");
                        gatt.discoverServices();
                    } catch (SecurityException se) {
                        call.reject("Permission error discovering services: " + se.getMessage());
                    }
                }

                @Override
                public void onServicesDiscovered(BluetoothGatt gatt, int status) {
                    if (status == BluetoothGatt.GATT_SUCCESS) {
                        BluetoothGattService service = gatt.getService(SERVICE_UUID);
                        if (service != null) {
                            Log.i(TAG, "[BLE-GATT] Service discovered: " + SERVICE_UUID);
                            targetChar = service.getCharacteristic(CHAR_UUID);
                            if (targetChar != null) {
                                Log.i(TAG, "[BLE-GATT] Characteristic discovered: " + CHAR_UUID);
                                prepareChunksAndStartWrite(gatt, targetChar, negotiatedMtu);
                                return;
                            }
                        }
                    }
                    Log.e(TAG, "[BLE-GATT] Target node did not expose Suraksha Setu BLE characteristic.");
                    call.reject("Target BLE node did not expose the required SOS characteristic.");
                    try {
                        gatt.disconnect();
                    } catch (SecurityException ignored) {}
                }

                private void prepareChunksAndStartWrite(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic, int mtu) {
                    int maxChunkSize = Math.max(20, mtu - 3);
                    chunks.clear();
                    currentChunkIndex = 0;

                    for (int i = 0; i < allPayloadBytes.length; i += maxChunkSize) {
                        int end = Math.min(allPayloadBytes.length, i + maxChunkSize);
                        chunks.add(Arrays.copyOfRange(allPayloadBytes, i, end));
                    }

                    Log.i(TAG, "[BLE-SOS-SEND] Sending SOS packet (" + allPayloadBytes.length + " bytes, " + chunks.size() + " chunk(s), maxChunkSize=" + maxChunkSize + " bytes, MTU=" + mtu + ")");
                    dispatchNextChunk(gatt, characteristic);
                }

                private void dispatchNextChunk(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic) {
                    if (currentChunkIndex >= chunks.size()) {
                        Log.i(TAG, "[BLE-SOS-SEND] SOS transmission completed on " + device.getAddress() + " (All " + chunks.size() + " chunks written successfully).");
                        JSObject res = new JSObject();
                        res.put("success", true);
                        res.put("targetDevice", device.getAddress());
                        res.put("message", "Packet transmitted over BLE GATT to " + device.getAddress() + " (" + chunks.size() + " chunks)");
                        call.resolve(res);
                        try {
                            gatt.disconnect();
                        } catch (SecurityException ignored) {}
                        return;
                    }

                    byte[] chunk = chunks.get(currentChunkIndex);
                    characteristic.setValue(chunk);
                    characteristic.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);

                    try {
                        boolean ok = gatt.writeCharacteristic(characteristic);
                        Log.i(TAG, "[BLE-SOS-SEND] Chunk " + (currentChunkIndex + 1) + "/" + chunks.size() + " (" + chunk.length + " bytes) dispatched: " + (ok ? "SUCCESS" : "FAILED"));

                        if (!ok) {
                            if (negotiatedMtu > 23) {
                                Log.w(TAG, "[BLE-SOS-SEND] Large chunk write failed. Retrying with fallback 20-byte chunk size...");
                                negotiatedMtu = 23;
                                prepareChunksAndStartWrite(gatt, characteristic, 23);
                            } else {
                                Log.e(TAG, "[BLE-SOS-SEND] Characteristic write failed synchronously even with 20-byte chunks.");
                                call.reject("Failed to dispatch BLE characteristic write.");
                                try {
                                    gatt.disconnect();
                                } catch (SecurityException ignored) {}
                            }
                        }
                    } catch (SecurityException se) {
                        call.reject("Security error writing characteristic: " + se.getMessage());
                    }
                }

                @Override
                public void onCharacteristicWrite(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic, int status) {
                    if (status == BluetoothGatt.GATT_SUCCESS) {
                        Log.i(TAG, "[BLE-SOS-SEND] Chunk " + (currentChunkIndex + 1) + "/" + chunks.size() + " confirmed by Gateway (GATT_SUCCESS).");
                        currentChunkIndex++;
                        dispatchNextChunk(gatt, characteristic);
                    } else {
                        Log.e(TAG, "[BLE-SOS-SEND] Chunk " + (currentChunkIndex + 1) + "/" + chunks.size() + " failed with GATT status: " + status);
                        if (negotiatedMtu > 23) {
                            Log.w(TAG, "[BLE-SOS-SEND] Retrying transmission with safe 20-byte chunk size...");
                            negotiatedMtu = 23;
                            prepareChunksAndStartWrite(gatt, characteristic, 23);
                        } else {
                            call.reject("Failed to write SOS packet over BLE, GATT status: " + status);
                            try {
                                gatt.disconnect();
                            } catch (SecurityException ignored) {}
                        }
                    }
                }
            }, BluetoothDevice.TRANSPORT_LE);
        } catch (SecurityException se) {
            call.reject("Security exception connecting GATT: " + se.getMessage());
        }
    }
}
