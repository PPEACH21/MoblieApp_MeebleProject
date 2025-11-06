import { StyleSheet } from "react-native";
import { Text,TextInput,View } from "react-native";
import { BaseColor as c } from "./Color";


export const TEXTinput = StyleSheet.create({
    
    Input1:{
        backgroundColor: c.white,
        color:c.black,
        borderColor:c.S1,
        borderRadius:13,
        borderWidth:3,
        fontSize:16,
        paddingHorizontal:15,
    },
    text01:{
        fontSize:14,
        fontWeight:'bold'
    }

})


export const TextInputSplash = ({name,setvalue,value})=>{
    return(
        <View style={{width:'100%',gap:5}}>
            <Text style={[TEXTinput.text01,{alignSelf:'flex-start'}]}>{name}</Text>
            <TextInput style={[TEXTinput.Input1,{width:'100%'}]} placeholder={name} value={value||""} onChangeText={(text)=>setvalue(text)}/>
        </View>
    )
}