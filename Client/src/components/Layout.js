import { StyleSheet } from "react-native";

export const Layout = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
    },
    columset:{
        flexDirection: "column",
        alignItems:"center",
        gap:10
    },
    rowset:{
        flexDirection:"row",
        alignItems:"center",
        gap:10
    },
    centerset:{
        flex:1,
        justifyContent:'center',
        alignItems:'center',
    },
    text: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "bold",
        textAlign:'center'
    },

})