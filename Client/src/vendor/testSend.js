import React, { useState } from "react";
import { View, Text, TextInput, Button, Alert, StyleSheet, ActivityIndicator } from "react-native";
import axios from "axios";
import { API_BASE } from "../config";

export default function TestInsertNote() {
  const [text, setText] = useState("");
  const [user, setUser] = useState("guest");
  const [loading, setLoading] = useState(false);

  const insert = async () => {
    if (!text.trim()) return Alert.alert("กรุณากรอกข้อความ");
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/api/notes`, { user, text: text.trim() }, {
        headers: { "Content-Type": "application/json" },
      });
      Alert.alert("✅ สำเร็จ", "บันทึกลง Firestore แล้ว");
      setText("");
    } catch (e) {
      Alert.alert("❌ Error", e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>เพิ่มข้อมูลลง DB (PUBLIC)</Text>
      <TextInput style={styles.input} value={user} onChangeText={setUser} placeholder="ชื่อผู้ใช้ (optional)"/>
      <TextInput style={[styles.input, {minHeight:80}]} value={text} onChangeText={setText} placeholder="พิมพ์ข้อความ..." multiline/>
      {loading ? <ActivityIndicator size="large"/> : <Button title="บันทึกลง DB" onPress={insert}/>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:{flex:1,justifyContent:"center",padding:16,gap:12,backgroundColor:"#f7f8fa"},
  title:{fontSize:18,fontWeight:"700",marginBottom:8},
  input:{borderWidth:1,borderColor:"#dcdcdc",backgroundColor:"#fff",borderRadius:10,padding:12}
});