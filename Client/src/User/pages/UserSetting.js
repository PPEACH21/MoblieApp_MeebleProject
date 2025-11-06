import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

export default function UserSettingScreen() {
  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold", marginBottom: 10 }}>ตั้งค่าผู้ใช้</Text>
      <TouchableOpacity style={{ padding: 10, backgroundColor: "#e2e8f0", borderRadius: 8 }}>
        <Text>ออกจากระบบ</Text>
      </TouchableOpacity>
    </View>
  );
}
