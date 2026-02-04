import React, { useState, useEffect } from 'react'
import { StyleSheet, View, Alert } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { Button, Text, IconButton } from 'react-native-paper'

interface QRScannerProps {
    onScan: (data: string) => void
    onClose: () => void
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
    const [permission, requestPermission] = useCameraPermissions()
    const [scanned, setScanned] = useState(false)

    if (!permission) {
        // Camera permissions are still loading.
        return <View style={styles.container} />
    }

    if (!permission.granted) {
        // Camera permissions are not granted yet.
        return (
            <View style={styles.container}>
                <Text style={styles.message}>We need your permission to show the camera</Text>
                <Button onPress={requestPermission} mode="contained" buttonColor="#FFD700" textColor="#000">
                    Grant Permission
                </Button>
                <Button onPress={onClose} textColor="#888" style={{ marginTop: 20 }}>
                    Cancel
                </Button>
            </View>
        )
    }

    const handleBarcodeScanned = ({ data }: { data: string }) => {
        if (!scanned) {
            setScanned(true)
            onScan(data)
        }
    }

    return (
        <View style={styles.fullScreenContainer}>
            <CameraView
                style={styles.camera}
                onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                barcodeScannerSettings={{
                    barcodeTypes: ['qr'],
                }}
            >
                <View style={styles.overlay}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Scan Lightning Invoice</Text>
                        <IconButton icon="close" iconColor="#fff" onPress={onClose} />
                    </View>
                    <View style={styles.scannerTarget}>
                        <View style={styles.cornerTopLeft} />
                        <View style={styles.cornerTopRight} />
                        <View style={styles.cornerBottomLeft} />
                        <View style={styles.cornerBottomRight} />
                    </View>
                    <Text style={styles.hint}>Place QR code inside the frame</Text>
                </View>
            </CameraView>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        backgroundColor: '#000',
    },
    fullScreenContainer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1000,
        backgroundColor: '#000',
    },
    message: {
        textAlign: 'center',
        paddingBottom: 20,
        color: '#fff',
        fontSize: 16,
    },
    camera: {
        flex: 1,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    header: {
        position: 'absolute',
        top: 60,
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
    },
    title: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    scannerTarget: {
        width: 250,
        height: 250,
        position: 'relative',
    },
    cornerTopLeft: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 40,
        height: 40,
        borderTopWidth: 4,
        borderLeftWidth: 4,
        borderColor: '#FFD700',
    },
    cornerTopRight: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 40,
        height: 40,
        borderTopWidth: 4,
        borderRightWidth: 4,
        borderColor: '#FFD700',
    },
    cornerBottomLeft: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: 40,
        height: 40,
        borderBottomWidth: 4,
        borderLeftWidth: 4,
        borderColor: '#FFD700',
    },
    cornerBottomRight: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 40,
        height: 40,
        borderBottomWidth: 4,
        borderRightWidth: 4,
        borderColor: '#FFD700',
    },
    hint: {
        color: '#fff',
        marginTop: 40,
        fontSize: 14,
        opacity: 0.8,
    },
})
