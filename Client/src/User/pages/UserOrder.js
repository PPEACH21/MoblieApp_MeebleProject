import React, { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { api } from "../../api/axios";

export default function UserOrderScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await api.get("/orders");
        setOrders(res.data || []);
      } catch (err) {
        console.log("โหลดคำสั่งซื้อไม่สำเร็จ", err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ padding: 10, borderBottomWidth: 0.5 }}>
            <Text>ร้าน: {item.shop_name}</Text>
            <Text>ยอดรวม: {item.total} บาท</Text>
            <Text>สถานะ: {item.status}</Text>
          </View>
        )}
      />
    </View>
  );
}
