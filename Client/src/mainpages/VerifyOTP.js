import { useEffect ,useState,useRef} from "react";
import { View,Text,TextInput,TouchableOpacity ,Keyboard} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { getProfile } from "../redux/actions/profileAction";
import { Layout } from "../components/Layout";
import { Btn } from "../components/Button";
import { BaseColor as c } from "../components/Color";
import axios from "../api/axios";
const VerifyOTP = ({ navigation }) => {
 const dispatch = useDispatch();
  const Profile = useSelector((state) => state.profile);
  const Auth = useSelector((state) => state.auth);

  useEffect(() => {
    sendmessage()
  },[]);

  const SendOTPRepassword = async() => {
    try {
      const res = await axios.post("/sendotp_repassword",{ email:Profile.email });
      console.log("OTP sent successfully:", res.data);
    } catch (err) {
      console.error("Error sending OTP:", err);
    }
  };

  const SendOTP = async () => {
    try {
      const res = await axios.post(
        "/sendotp",
        {
          username: Profile.username,
          email: Profile.email,
        },{headers: { Authorization: `Bearer ${Auth.token}` },});

      console.log("OTP sent successfully:", res.data);
    } catch (err) {
      console.error("Error sending OTP:", err);
    }
  };

  const sendmessage = () => {
    if(Auth){
      dispatch(getProfile());
      SendOTP()
    }else{
      SendOTPRepassword()
    }
  };

  const [otp, setOtp] = useState(new Array(6).fill(""));
  const inputRefs = useRef([]);

  const handleChange = (text, index) => {
    if (/^[0-9]?$/.test(text)) {
      const newOtp = [...otp];
      newOtp[index] = text;
      setOtp(newOtp);
      if (text && index < 5) {
        inputRefs.current[index + 1].focus();
      }
      if (index === 5 && text) Keyboard.dismiss();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  
  const handleVerify =async() => {
    const code = otp.join("");
    console.log("🔢 OTP:", code);
    if (code.length === 6) {
      try{
        if (Auth) {
        const res = axios.post("/checkotp",{ otp: code, email: Profile?.email });
        console.log("checkOTP Success", res?.status);
        
        const updatadata = await axios.put(
          `/verifiedEmail/${Auth?.user}`,
          {},{headers: { Authorization: `Bearer ${Auth.token}` },}
        );
        console.log("Verified success:", updatadata?.data);
        if(Auth.role==="vendor"){
          navigation.navigate("HomeVendor")
        }else{
          navigation.navigate("HomeUser")
        }
      }else{
        const res = await axios.post(`/checkotp`, { otp: code, email:Profile.email });
        console.log("checkOTP Success", res?.status);
        console.log("Changepassword Page");
      }
      }catch(err){
        errmsg("OTP not correct")
        console.log("OTP not correct")
      }

    } else {
      alert("กรุณากรอกรหัสให้ครบ 6 หลัก");
    }
  };

   return (
    <View style={[Layout.container ,Layout.centerset,{gap:40}]}>
      <View>
        <Text style={{fontSize:20,fontWeight:'bold',textAlign:'center'}} >กรอกรหัส OTP</Text>
        <Text style={{fontSize:20}} >Plese Enter your OTP</Text>
      </View>

      <View style={[Layout.rowset,{width:'100%',justifyContent:'center'}]} >
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => (inputRefs.current[index] = ref)}
            value={digit}
            onChangeText={(text) => handleChange(text, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            keyboardType="number-pad"
            maxLength={1}
            style={[Btn.Btn2,{paddingVertical:20,color:c.S1,fontSize:20, paddingHorizontal:0, width:45,height:75, textAlign:'center',fontWeight:'bold'}]}
          />
        ))}
      </View>

      <TouchableOpacity
        style={[Btn.Btn1,{paddingHorizontal:40}]} 
        onPress={sendmessage}
      >
        <Text style={[Btn.textBtn1]}>ส่งOTPใหม่</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[Btn.Btn1,{paddingHorizontal:40}]} 
        onPress={handleVerify}
      >
        <Text style={[Btn.textBtn1]}>ยืนยันรหัส</Text>
      </TouchableOpacity>
    </View>
  );

};

export default VerifyOTP;
