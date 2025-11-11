import { useEffect ,useState,useRef} from "react";
import { View,Text,TextInput,TouchableOpacity ,Keyboard} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { getProfile } from "../redux/actions/profileAction";
import { Layout } from "../components/Layout";
import { Btn } from "../components/Button";
import { BaseColor as c } from "../components/Color";
import { api } from "../api/axios";
import Loading from "./Loading";
import { TextInputSplash } from "../components/TextInput";

const VerifyOTP = ({ navigation}) => {
 const dispatch = useDispatch();
  const Profile = useSelector((state) => state.profile);
  const Auth = useSelector((state) => state.auth);
  
  const [email,setEmail] = useState("");
  const [newPassword,setNewpassword] = useState("");
  const [conNewPassword,setconNewPassword] = useState("");
  const [state,setState] = useState(1);
  useEffect(() => {
    sendmessage();
  },[]);
  
  const [otpCooldown, setOtpCooldown] = useState(0); 
  const [errmsg, setErrmsg] = useState(""); 

  useEffect(() => {
    let timer;
    if (otpCooldown > 0) {
      timer = setTimeout(() => setOtpCooldown(otpCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [otpCooldown]);

   const SendOTP = async (profileData) => {
    try {
      const res = await api.post(
        "/sendotp",
        {
          username: profileData.username,
          email: profileData.email,
        },{headers: { Authorization: `Bearer ${Auth.token}` },});

      console.log("OTP sent successfully:", res.data);
      setOtpCooldown(15);
    } catch (err) {
      console.error("Error sending OTP:", err);
    }
  };

  const sendmessage =async() => {
    if (otpCooldown > 0) return;
    if(Auth.user){
      const profileData = await dispatch(getProfile());
      console.log(profileData)
      await SendOTP(profileData);
    }else{
      if (!email) {
        setState(0);
        return;
      }
      await SendOTPRepassword();
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


  const SendOTPRepassword = async() => {
    try {
      console.log(email)
      const res = await api.post("/sendotp_repassword",{ email:email });
      console.log("OTP sent successfully:", res.data);
      setOtpCooldown(15);
    } catch (err) {
      console.error("Error sending OTP:", err);
    }
  };
  
  const handleVerify =async() => {
    const code = otp.join("");
    console.log("OTP:", code);
    if (code.length === 6) {
      try{
        if (Auth.user) {
        const res = api.post("/checkotp",{ otp: code, email: Profile?.email});
        console.log("checkOTP Success", res?.status);
        
        const updatadata = await api.put(
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
        const res = await api.post(`/checkotp`, { otp: code, email:email });
        console.log("checkOTP Success", res?.status);
        setState(2);
      }
      }catch(err){
        errmsg("OTP not correct")
        console.log("OTP not correct")
      }

    } else {
      alert("กรุณากรอกรหัสให้ครบ 6 หลัก");
    }
  };

  const SubmitPassword=async()=>{
      try{
          if(newPassword.length<8 || conNewPassword.length<8)
              return setErrmsg("password must have 8")
          if(conNewPassword!=newPassword){
              return setErrmsg("Password Notmatch")
          }

          setErrmsg("")            
          const res = await api.put("/changepassword", {email:email,password:newPassword});
          console.log("changePassword Success",res)
          navigation.replace("Splash")
      }catch(err){
          console.log("Email not Correct",err)
          setErrmsg("Email not Correct");
      }
  }


   return (
    <View style={[Layout.container ,Layout.centerset,{gap:40}]}>
      
      <View>
        {state===0&&(
          <View>
            <Text style={{fontSize:25,fontWeight:'bold',textAlign:'center'}} >กรอกEmail</Text>
            <Text style={{fontSize:20}} >Plese Enter your Email</Text>
          </View>
        )}
        {state===1&&(
          <View>
            <Text style={{fontSize:25,fontWeight:'bold',textAlign:'center'}} >กรอกรหัส OTP</Text>
            <Text style={{fontSize:20}} >Plese Enter your OTP</Text>
          </View>
        )}
        {state===2&&(
          <View>
            <Text style={{fontSize:25,fontWeight:'bold',textAlign:'center'}} >กรอกรหัสใหม่</Text>
            <Text style={{fontSize:20}} >Plese Enter your NewPassword</Text>
          </View>
        )}
      </View>

      {state===0&&(
        <View style={{width:'80%', gap:20}}>
          <TextInputSplash name="Email" value={email} setvalue={setEmail} type={"email"}/>
          <TouchableOpacity
            style={[Btn.Btn1,{paddingHorizontal:40}]} 
            onPress={()=>{setState(1),sendmessage()}}
          >
            <Text style={[Btn.textBtn1]}>ยืนยันEmail</Text>
          </TouchableOpacity>
        </View>
      )} 
      
      {state===1&&(
        <View>
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
            style={[{paddingHorizontal:40, alignSelf:'flex-end'}]} 
            onPress={sendmessage}
            disabled={otpCooldown > 0}
          >
            <Text style={{textAlign:'right'}}>{otpCooldown > 0 ? `ส่งใหม่อีก ${otpCooldown} วินาที` : "ส่ง OTP ใหม่"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[Btn.Btn1,{paddingHorizontal:40}]} 
            onPress={handleVerify}
          >
            {errmsg!=''&&(<Text style={[{ textAlign: 'center',color:c.red,fontWeight:'bold' }]}>{errmsg}</Text>)}
            <Text style={[Btn.textBtn1]}>ยืนยันรหัส</Text>
          </TouchableOpacity>
        </View>
      )} 

       {state===2&&(
        <View style={{width:'80%', gap:20}}>
          <TextInputSplash name="new password" value={newPassword} setvalue={setNewpassword} type={"password"}/>
          <TextInputSplash name="Confirm new password" value={conNewPassword} setvalue={setconNewPassword} type={"password"}/>
          
          {errmsg!=''&&(<Text style={[{ textAlign: 'center',color:c.red,fontWeight:'bold' }]}>{errmsg}</Text>)}
          <TouchableOpacity
            style={[Btn.Btn1,{paddingHorizontal:40}]} 
            onPress={SubmitPassword}
          >
            <Text style={[Btn.textBtn1]}>ยืนยัน</Text>
          </TouchableOpacity>
        </View>
      )} 
      {Profile.loading&&(<Loading/>)}
    </View>
  );

};

export default VerifyOTP;
