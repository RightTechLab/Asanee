import React, { useState } from 'react'
import { StyleSheet, View, Pressable } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { Button, Text } from 'react-native-paper'
import { X } from 'lucide-react-native'
import { Colors, Spacing } from '../theme'

interface QRScannerProps {
    onScan: (data: string) => void
    onClose: () => void
    title?: string
}

export default function QRScanner({ onScan, onClose, title = 'Scan Lightning Invoice' }: QRScannerProps) {
    const [permission, requestPermission] = useCameraPermissions()
    const [scanned, setScanned] = useState(false)

    if (!permission) return <View style={styles.container} />

    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <Text style={styles.message}>We need camera permission to scan QR codes</Text>
                <Button onPress={requestPermission} mode="contained" buttonColor={Colors.accent} textColor={Colors.accentText}>
                    Grant Permission
                </Button>
                <Button onPress={onClose} textColor={Colors.textSecondary} style={{ marginTop: Spacing.lg }}>
                    Cancel
                </Button>
            </View>
        )
    }

    const handleBarcodeScanned = ({ data }: { data: string }) => {
        if (!scanned) { setScanned(true); onScan(data) }
    }

    return (
        <View style={styles.fullScreen}>
            <CameraView
                style={styles.camera}
                onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            >
                <View style={styles.overlay}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{title}</Text>
                        <Pressable onPress={onClose} hitSlop={12}>
                            <X size={22} color="#fff" />
                        </Pressable>
                    </View>
                    <View style={styles.target}>
                        <View style={[styles.corner, styles.tl]} />
                        <View style={[styles.corner, styles.tr]} />
                        <View style={[styles.corner, styles.bl]} />
                        <View style={[styles.corner, styles.br]} />
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
        alignItems: 'center',
        backgroundColor: Colors.bg,
        padding: Spacing.lg,
    },
    fullScreen: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1000,
        backgroundColor: Colors.bg,
    },
    message: {
        textAlign: 'center',
        paddingBottom: Spacing.lg,
        color: Colors.text,
        fontSize: 15,
    },
    camera: { flex: 1 },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
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
        paddingHorizontal: Spacing.lg,
    },
    title: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '600',
    },
    target: {
        width: 250,
        height: 250,
        position: 'relative',
    },
    corner: {
        position: 'absolute',
        width: 36,
        height: 36,
    },
    tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderColor: Colors.accent },
    tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderColor: Colors.accent },
    bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: Colors.accent },
    br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderColor: Colors.accent },
    hint: {
        color: '#fff',
        marginTop: Spacing.xl,
        fontSize: 13,
        opacity: 0.7,
    },
})
