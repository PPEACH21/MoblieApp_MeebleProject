import { View, Text, Pressable,Modal, ScrollView, Image, TouchableOpacity} from "react-native";
import { useState } from "react";
import {getLocale,setLocale} from "../../paraglide/runtime"
import {Layout} from "../../components/Layout"
import { useDispatch,useSelector } from "react-redux";
import { resetAuth } from "../../redux/slices/authSlice";
import { BaseColor as c } from "../../components/Color";
import { Btn } from "../../components/Button";
import {TextInputSetting} from "../../components/TextInput"
import { TEXTinput } from "../../components/TextInput";
import * as ImagePicker from "expo-image-picker";
import { UpdateProfile } from "../../redux/actions/profileAction";

export default function UserSettingScreen({navigation}) {
  const [language, setLaguage] = useState(getLocale());
  const toggleLanguage = () => {
      const newLang = language === "th" ? "en" : "th";
      console.log(language)
      setLocale(newLang);
      setLaguage(newLang);
  };
  

  const Dispatch = useDispatch();
  const Profile = useSelector((state)=>state.profile);
  const [openEditProfile,setOpenEditProfile] =useState(false);
  const [localImg, setLocalImg] = useState(Profile.avatar);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [name, setName] = useState({
    Firstname:Profile.firstname,
    Lastname:Profile.lastname,
  });
  
  const onSaveEdit = async () => {
    try {
      await Dispatch(UpdateProfile({data:{firstname:name.Firstname.trim() || "",lastname:name.Lastname.trim() || "",avatar:localImg || ""}}))
      setLocalImg(Profile.avatar)
      setName({Firstname:Profile.lirstname,Lastname:Profile.lastname})
      setOpenEditProfile(false);
    } catch (e) {
      setName({Firstname:Profile.firstname,Lastname:Profile.lastname})
      setLocalImg(Profile.avatar)
      console.log("อัปเดตร้านไม่สำเร็จ")
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("ต้องการสิทธิ์", "กรุณาอนุญาตเข้าถึงคลังภาพ");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) {
      const a = result.assets[0];
      if (a.base64) {
        const mime = a.mimeType || guessMimeFromUri(a.uri);
        const dataUrl = `data:${mime};base64,${a.base64}`;
        setLocalImg(dataUrl);
        setEdit((s) => ({ ...s, image: dataUrl }));
      } else if (a.uri) {
        setLocalImg(a.uri);
        setEdit((s) => ({ ...s, image: a.uri }));
      }
    }
  };

  const cuttext = (text, maxLength) => {
    if (!text) return "-";
    return text.length > maxLength ? text.slice(0, maxLength) + "…" : text;
  };  
  return (
    <View style={[Layout.container]}>
      <ScrollView>
        <View style={{ flex: 1, padding: 20, gap:10 }}>
          <Text style={{ fontSize: 20, fontWeight: "bold", marginTop: 15 }}>ตั้งค่าผู้ใช้</Text>
          <View style={{gap:10, padding:20,backgroundColor:c.white ,borderRadius:20,shadowRadius:20,shadowColor:c.black,shadowOpacity: 0.06 ,shadowOffset:{ width: 3, height: 40 },elevation: 7}}>
            <Image source={{uri:Profile.avatar||""}}  width={200} height={200} style={{alignSelf:'center',backgroundColor:c.whitegary, borderRadius:200}} >
              
            </Image>
              <View style={{marginLeft:20}}>
                <Text style={{fontWeight:'bold' ,flexShrink: 1,}}> Fullname : {cuttext(`${Profile.firstname||"-"} ${Profile.lastname||"-"}`,27)}</Text>
                <Text style={{fontWeight:'bold',flexShrink: 1}}> Username :{Profile.username||"-"}</Text>
                <Text style={{fontWeight:'bold',flexShrink: 1}}> Email: {Profile.email||"-"}</Text>
              </View>
          </View>

          <View style={{gap:10}}>
            <Pressable onPress={()=>{console.log(Profile)}} style={{ padding: 10, backgroundColor: "#e2e8f0", borderRadius: 8 }}>
              <Text>CHECK</Text>
            </Pressable>
            <Pressable onPress={()=>{setName({Firstname:Profile.firstname,Lastname:Profile.lastname});setOpenEditProfile(true)}} style={{ padding: 10, backgroundColor: "#e2e8f0", borderRadius: 8 }}>
              <Text>ตั้งค่าผู้ใช้</Text>
            </Pressable>
            <Pressable onPress={toggleLanguage} style={{ padding: 10, backgroundColor: "#e2e8f0", borderRadius: 8 }}>
              <Text>language</Text>
            </Pressable>
            <Pressable onPress={()=>{Dispatch(resetAuth());navigation.replace("Splash")}} style={{ padding: 10, backgroundColor: "#e2e8f0", borderRadius: 8 }}>
              <Text>ออกจากระบบ</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <Modal
        transparent
        visible={openEditProfile}
        animationType="slide"
        onRequestClose={() => setOpenEditProfile(false)}
      >
        <View style={{flex:1,backgroundColor:"rgba(0,0,0,0.25)" ,justifyContent: "flex-end",}}>
          <View style={{backgroundColor:c.fullwhite,padding: 16,borderTopLeftRadius: 16,borderTopRightRadius: 16,width:'100%',maxHeight:"90%" }}>
             <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  marginBottom: 12,
                  color: c.black,
                }}
              >
                แก้ไขข้อมูลบัญชี
              </Text>
            <View style={{justifyContent:'space-evenly', gap:10}}>
              <Image source={{uri:localImg||""}}  width={100} height={100} style={{ alignSelf:'center',backgroundColor:c.whitegary, borderRadius:200}} ></Image>
              <TouchableOpacity onPress={pickImage} disabled={uploadingImage} style={[Btn.Btn1,{width:"30%", alignSelf:'center'}]}><Text style={[Btn.textBtn1,{fontSize:10}]}>{uploadingImage ? "กำลังอัปโหลด…" : "เปลี่ยนรูป"}</Text></TouchableOpacity>
            </View>
            <View style={{gap:5}}>
              <View style={{flexDirection:'row',justifyContent:"space-between",width:'100%'}}>
                <TextInputSetting width={"49%"} name={"Firstname"} value={name.Firstname} setvalue={(text)=>setName({...name,Firstname:text})}/>
                <TextInputSetting width={"49%"} name={"Lastname"} value={name.Lastname} setvalue={(text)=>setName({...name,Lastname:text})}/>
              </View>

              <View style={{gap:5}}>
                  <Text style={[TEXTinput.text01,{alignSelf:'flex-start', fontSize:13}]}>Username</Text>
                  <Text style={[TEXTinput.Input1,{backgroundColor:c.whitegary,width:'100%' ,paddingVertical:10,borderWidth:2 ,fontSize:13}]}>{Profile.username}</Text>
              </View>
              <View style={{gap:5}}>
                  <Text style={[TEXTinput.text01,{alignSelf:'flex-start', fontSize:13}]}>Email</Text>
                  <Text style={[TEXTinput.Input1,{backgroundColor:c.whitegary,width:'100%' ,paddingVertical:10,borderWidth:2 ,fontSize:13}]}>{Profile.email}</Text>
              </View>
              <View style={{flexDirection:'row',justifyContent:'space-around', marginTop:20}}>
                <TouchableOpacity onPress={()=>{setLocalImg(Profile.avatar);setOpenEditProfile(false);}} style={[Btn.Btn2,{padding:5,width:'48%'}]}><Text style={[Btn.textBtn2]}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity onPress={onSaveEdit} style={[Btn.Btn1,{padding:5,width:'48%'}]}><Text style={[Btn.textBtn1]}>Save</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
