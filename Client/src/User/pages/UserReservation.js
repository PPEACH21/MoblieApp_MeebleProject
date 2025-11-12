import React, { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { api } from "../../api/axios";

export default function UserReserveScreen() {
  const [reserves, setReserves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReserves = async () => {
      try {
        const res = await api.get("/reservations/user");
        setReserves(res.data || []);
      } catch (err) {
        console.log("โหลดข้อมูลการจองไม่สำเร็จ", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReserves();
  }, []);

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <FlatList
        data={reserves}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ padding: 10, borderBottomWidth: 0.5 }}>
            <Text>ร้าน: {item.shop_name}</Text>
            <Text>วันที่จอง: {item.date}</Text>
            <Text>สถานะ: {item.status}</Text>
          </View>
        )}
      />
    </View>
  );
}
