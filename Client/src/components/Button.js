import { StyleSheet } from "react-native"
import { BaseColor as c } from "./Color"
import { Layout } from "./Layout"

export const Btn = StyleSheet.create({

    Btn1:{
        backgroundColor: c.S1,
        padding:10,
        paddingHorizontal:20,
        borderRadius:15,
        borderColor: 'transparent',
        borderWidth: 3,
    },
    textBtn1:{
        color:c.fullwhite,
        fontWeight:"bold",
        fontSize:20,
        textAlign:'center'
    },
    Btn2:{
        backgroundColor: c.white,
        padding:10,
        paddingHorizontal:20,
        borderRadius:15,
        borderColor: c.S1,
        borderWidth:2.5,
    },
    textBtn2:{
        color:c.S2,
        fontWeight:"bold",
        fontSize:20,
        textAlign:'center'
    },
    

})