package com.gulfer.gesture

import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.content.Context
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Kotlin native module for gesture detection using accelerometer
 * 
 * This module will detect gestures even when the phone is asleep:
 * - Throw landing gesture
 * - Hole start gesture
 * - Hole end gesture
 */
class GestureDetector(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), SensorEventListener {
    
    private val sensorManager: SensorManager = reactContext.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val accelerometer: Sensor? = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    
    private var isListening = false
    private val accelerationThreshold = 15.0f // m/s^2 threshold for gesture detection
    private var lastAcceleration = FloatArray(3)
    
    override fun getName(): String {
        return "GestureDetector"
    }
    
    @ReactMethod
    fun startGestureDetection(promise: Promise) {
        if (accelerometer == null) {
            promise.reject("NO_SENSOR", "Accelerometer not available")
            return
        }
        
        if (isListening) {
            promise.resolve("Already listening")
            return
        }
        
        sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_NORMAL)
        isListening = true
        promise.resolve("Gesture detection started")
    }
    
    @ReactMethod
    fun stopGestureDetection(promise: Promise) {
        if (!isListening) {
            promise.resolve("Not listening")
            return
        }
        
        sensorManager.unregisterListener(this)
        isListening = false
        promise.resolve("Gesture detection stopped")
    }
    
    override fun onSensorChanged(event: SensorEvent?) {
        if (event?.sensor?.type == Sensor.TYPE_ACCELEROMETER && isListening) {
            val x = event.values[0]
            val y = event.values[1]
            val z = event.values[2]
            
            // Calculate acceleration magnitude
            val acceleration = Math.sqrt((x * x + y * y + z * z).toDouble()).toFloat()
            
            // Detect sudden changes (gestures)
            val delta = Math.abs(acceleration - lastAcceleration[0])
            
            if (delta > accelerationThreshold) {
                // Determine gesture type based on pattern
                val gestureType = detectGestureType(x, y, z, acceleration)
                
                if (gestureType != null) {
                    sendGestureEvent(gestureType)
                }
            }
            
            lastAcceleration[0] = acceleration
            lastAcceleration[1] = x
            lastAcceleration[2] = y
        }
    }
    
    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // Handle accuracy changes if needed
    }
    
    private fun detectGestureType(x: Float, y: Float, z: Float, acceleration: Float): String? {
        // TODO: Implement gesture pattern recognition
        // This is a placeholder - actual implementation will analyze patterns
        // over time to distinguish between different gesture types
        
        // Simple threshold-based detection for now
        if (acceleration > 20.0f) {
            return "throw_landing"
        } else if (acceleration > 12.0f && acceleration < 18.0f) {
            return "hole_start"
        } else if (acceleration > 10.0f && acceleration < 15.0f) {
            return "hole_end"
        }
        
        return null
    }
    
    private fun sendGestureEvent(gestureType: String) {
        val params = com.facebook.react.bridge.Arguments.createMap()
        params.putString("gestureType", gestureType)
        params.putDouble("timestamp", System.currentTimeMillis().toDouble())
        
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("onGestureDetected", params)
    }
}

