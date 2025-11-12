import { Text, View, TouchableOpacity, Keyboard, TouchableWithoutFeedback  } from "react-native";
import { useEffect, useState } from "react";
import { TextInputSplash } from "../components/TextInput";
import Loading from "./Loading";

import Animated, {useSharedValue,useAnimatedStyle,withDelay,withSequence,withTiming,Easing,cubicBezier,FadeIn,FadeOut} from "react-native-reanimated";
import { Layout } from "../components/Layout";
import { BaseColor as c } from "../components/Color";
import { SafeAreaView } from "react-native-safe-area-context";
import { Btn } from "../components/Button";
import { useDispatch,useSelector } from "react-redux";
import { loginUser,registerID } from "../redux/actions/authAction";
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { getLocale,setLocale } from "../paraglide/runtime";
import {m} from "../paraglide/messages";

const Splash = ({ navigation }) => {
    //AUTH 
    const Dispath = useDispatch();
    const Auth = useSelector((state) => state.auth); 
    const CheckAuth =()=>{
        console.log("Loading Auth");
        console.log(Auth);

        if (!Auth.user || Auth.loading) return;
        if (Auth.user && !Auth.verified){
            navigation.replace("verifyotp")
        }else if (Auth.role==="user" && Auth.verified) {
            navigation.replace("HomeUser")
        }else if (Auth.role==="vendor" && Auth.verified) {
            navigation.replace("HomeVendor")
        }
    }
    //AUTH

    //AnimationSet
    const yOpen = useSharedValue(0);
    const xOpen = useSharedValue(0);
    const scOpen = useSharedValue(20);
    const bounceAndSlide = () => {
        xOpen.value = -200;
        yOpen.value = -400;
        scOpen.value = 1;
        yRegister.value = 800;
        opacityOpen.value = 0;
        setIsToggled(false);
        setlogin(false);
        setRegister(false);

        yOpen.value = withSequence(
            withDelay(500, withTiming(-400)),
            withTiming(0, {
                duration: 500,
                easing: Easing.bounce,
            })
        );

        xOpen.value = withSequence(
            withDelay(500, withTiming(-200)),
            withTiming(0, {
                duration: 700,
                easing: Easing.out(Easing.exp),
            })
        );

        scOpen.value = withSequence(
            withDelay(900, withTiming(1)),
            withTiming(20, {
                duration: 1000,
                easing: Easing.inOut(Easing.circle),
            })
        );
    };
    const animatedOpen = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: xOpen.value },
                { translateY: yOpen.value },
                { scale: scOpen.value },
            ],
        };
    });

    const opacityOpen = useSharedValue(0);
    const WelcomeSlice = () => {
        opacityOpen.value = withSequence(
            withDelay(1300, withTiming(0)),
            withTiming(1, { duration: 1000 })
        );
    };
    const animatedWelcome = useAnimatedStyle(() => {
        return {
            opacity: opacityOpen.value,
        };
    });

    const yOpenmove = useSharedValue(600);
    const Openmove = useAnimatedStyle(() => ({
        transform: [
            {
                translateY: withTiming(yOpenmove.value, {
                    duration: 1000,
                    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
                }),
            },
        ],
    }));

    const [login, setlogin] = useState(false);
    const yLogin = useSharedValue(600);
    const yLoginHead = useSharedValue(2);
    const LoginTrigger = useAnimatedStyle(() => ({
        transform: [
            {
                translateY: withTiming(yLogin.value, {
                    duration: 1000,
                    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
                }),
            },
        ],
    }));
    const LoginTriggerHead = useAnimatedStyle(() => ({
        transform: [
            {
                translateY: withTiming((yLoginHead.value) * yLogin.value, {
                    duration: 1500,
                    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
                }),
            },
        ],
    }));

    const [register, setRegister] = useState(false);
    const yRegister = useSharedValue(600);
    const yRegisterHead = useSharedValue(200);
    const RegisterTrigger = useAnimatedStyle(() => ({
        transform: [
            {
                translateY: withTiming(yRegister.value, {
                    duration: 1000,
                    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
                }),
            },
        ],
    }));
    const RegisterTriggerHead = useAnimatedStyle(() => ({
        transform: [
            {
                translateY: withTiming(yRegisterHead.value * yRegister.value, {
                    duration: 1000,
                    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
                }),
            },
        ],
    }));

    const [isToggled, setIsToggled] = useState(false);
    const whitebar = useSharedValue(1200);

    const whiteslide = useAnimatedStyle(() => ({
        transform: [
            {
                translateY: withTiming(whitebar.value, {
                    duration: 1000,
                    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
                }),
            },
        ],
    }));

    const rotate = {
        from: {
            transform: [{ rotateZ: '0deg' }],
        },
        to: {
            transform: [{ rotateZ: '360deg' }],
        },
    };


    useEffect(() => {
        yOpenmove.value = isToggled ? 600 : 0;
        !isToggled&& (whitebar.value =900)
    }, [isToggled]);

    useEffect(() => {
        yLoginHead.value = login ? 0 : 2;
        
        yLogin.value = login ? 90 : 600;
        login&&(
            whitebar.value = isToggled ? 250 : 900,
            setRegisterinput({
                Email: "",
                Username: "",
                Password: "",
                ConfirmPassword: "",
            }),
            setErrmsg(""),
            setRolesetup("user")
        )
    }, [login]);

    useEffect(() => {
        yRegister.value = register ? 90 : 700;
        yRegisterHead.value = register ? 0 : 2;
        
        register&&(
            whitebar.value = isToggled ? 200 : 900,
            setLogininput({
            Username: "",
            Password: "",
            }),
            setChooseRole(false),
            setErrmsg("")
        )
    }, [register]);

    useEffect(() => {
        bounceAndSlide();
        WelcomeSlice();
        CheckAuth()
    }, []);

    useEffect(() => {
        const showSub = Keyboard.addListener("keyboardDidShow", () => {
            if (login) {
                yLogin.value = -10
                whitebar.value = 160
            }
            if (register) {
                yRegister.value = -70;
                whitebar.value = 50
            }
        });
        
        const hideSub = Keyboard.addListener("keyboardDidHide", () => {
            if (login) {
                yLogin.value = 90
                whitebar.value = 260
            }
            if (register) {
                yRegister.value = 90
                whitebar.value = 200
            }
            if(login ===false && register === false){
                whitebar.value = 900;
            }
        });
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, [login, register]);
    //AnimationSet

    //dataset
    const [logininput, setLogininput] = useState({
        Username: "",
        Password: ""
    })
    const [registerinput, setRegisterinput] = useState({
        Email: "",
        Username: "",
        Password: "",
        ConfirmPassword: ""
    })
    const [errmsg,setErrmsg] = useState("");
    //dataset

    //validation
    const SubmitLogin=async()=>{
        setErrmsg("")
        if(logininput.Username==="" || logininput.Password===""){
            return setErrmsg(m.IncompleteInfo())
        }
        Dispath(loginUser({
            username:logininput.Username,
            email:logininput.Username,
            password:logininput.Password,
        }))
    }
    const SubmitRegister=()=>{
        setErrmsg("")
        if(registerinput.Email==="" || registerinput.Username==="" ||  registerinput.Password==="" || registerinput.ConfirmPassword===""){
            return setErrmsg(m.IncompleteInfo())
        }
        
        if(registerinput.Password != registerinput.ConfirmPassword){
            return setErrmsg(m.password_not_match())
        }
        if(registerinput.Username.length<5){
            return setErrmsg(m.username_min_length())
        }
        if(registerinput.Password.length<8 && registerinput.Password.length<8){
            return setErrmsg(m.password_min_length())
        }

        Dispath(registerID({
            email:registerinput.Email,
            username:registerinput.Username,
            password:registerinput.Password,
            role:Rolesetup
        }))
    }
    //validation
    
    // Register State
    const [Rolesetup,setRolesetup] = useState("user");
    const [chooseRole,setChooseRole] = useState(false)
    // Register State

    useEffect(() => {
        if (!login || Auth.loading) return;
        if (Auth.error) {
            setErrmsg("Login Fail: " + Auth.error);
        } else if (Auth.user) {
            CheckAuth(); 
        }
    }, [Auth.loading, Auth.error, Auth.user, login]);

    useEffect(() => {
    if (!register || Auth.loading) return;
    if (Auth.error) {
        setErrmsg("Register Fail: " + Auth.error);
    } else if (Auth.user) {
        navigation.navigate("verifyotp", { email: registerinput.Email });
    }
    }, [Auth.loading, Auth.error, Auth.user, register]);
    
    const [language, setLaguage] = useState(getLocale());
    const toggleLanguage = () => {
        const newLang = language === "th" ? "en" : "th";
        console.log(language)
        setLocale(newLang);
        setLaguage(newLang);
    };

    return (
        <SafeAreaView style={[Layout.centerset, { backgroundColor: c.white }]}>
            <TouchableWithoutFeedback onPress={() => {setlogin(false);setRegister(false);setIsToggled(false);}}>
                <Animated.View
                    onPress={()=>{setlogin(false), setRegister(false), setIsToggled(false)}}
                    style={[
                        {
                            position: "absolute",
                            width: 50,
                            height: 50,
                            borderRadius: 40,
                            backgroundColor: c.S1,
                        },
                        animatedOpen,
                    ]}
                />
            </TouchableWithoutFeedback>

            <Animated.View style={[Layout.container, Layout.columset, animatedWelcome, Openmove]}>
                <Animated.View
                    style={[
                        {
                            top: 10,
                            right: -100,
                            width: 200,
                            height: 200,
                            borderRadius: 10,
                            position: "absolute",
                            animationName: rotate,
                            animationDuration: '5s',
                            backgroundColor: c.S2,
                            animationIterationCount: 'infinite',
                            animationTimingFunction: cubicBezier(0.25, -0.5, 0.25, 1),
                        },
                    ]}
                />
                <Animated.View
                    style={[
                        {
                            bottom: 20,
                            left: -100,
                            width: 300,
                            height: 300,
                            borderRadius: 10,
                            position: "absolute",
                            animationName: rotate,
                            animationDuration: '7s',
                            backgroundColor: c.S4,
                            animationIterationCount: 'infinite',
                            animationTimingFunction: cubicBezier(0.25, -0.5, 0.25, 1),
                        },
                    ]}
                />
                <TouchableOpacity onPress={toggleLanguage} style={[Btn.Btn2,{alignSelf:'flex-end',marginTop:20}]}>
                    <Text style={{fontSize:10}}>{m.Language()}</Text>
                </TouchableOpacity>
                <View style={[{ flex: 1, justifyContent: "center" ,marginTop:-50}]}>
                    <Text
                        style={{
                            fontSize: 55,
                            color: c.fullwhite,
                            fontWeight: "bold",
                            justifyContent: "flex-start",
                        }}
                    >
                        MEEBLE
                    </Text>
                    <Text style={{ width:250,fontSize: 16, color: c.fullwhite, fontWeight: "bold" }}>
                        {m.project_description01()}
                    </Text>
                </View>

                <View style={[{ flex: 1 }]}>
                    {!Auth.user && (
                        <View style={[Layout.centerset, Layout.rowset, { justifyContent: 'space-evenly' }]} >
                            <TouchableOpacity onPress={() => { 
                                setRegister(true), 
                                setIsToggled(true),
                                setlogin(false) 
                            }} style={[Btn.Btn2, { width: "45%" }]}>
                                <Text style={Btn.textBtn2}>{m.register_s()}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[Btn.Btn2, { width: "45%" }]}
                                onPress={() => {
                                    setIsToggled(opacityOpen&&(!login));
                                    setlogin(opacityOpen&&(!login));
                                    setRegister(false) 
                                }}
                            >
                                <Text style={Btn.textBtn2}>{m.login()}</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </Animated.View>

            <Animated.View style={[{ position: "absolute", top: 100 }, LoginTriggerHead]}>
                <Text style={{ fontSize: 60, fontWeight: 'bold', color: c.fullwhite }}>{m.LOGIN()}</Text>
            </Animated.View>
            <Animated.View style={[{ position: "absolute", top: 100, width:"100%", alignItems:'center'}, RegisterTriggerHead]}>
                {!chooseRole?
                <Animated.View
                    key="chooseRole"
                    exiting={FadeOut}
                >
                    <Text style={{ fontSize: 50, fontWeight: 'bold', color: c.fullwhite }}>{m.choose_role()}</Text>
                </Animated.View>
                :
                <Animated.View
                    entering={FadeIn}
                >
                    <Text style={{ fontSize: 55, fontWeight: 'bold', color: c.fullwhite }}>{m.REGISTER()}</Text>
                </Animated.View>
                }
            </Animated.View>

            <Animated.View
                style={[
                    {
                        position: "absolute",
                        width: "100%",
                        height: "100%",
                        borderTopRightRadius: 90,
                        borderTopLeftRadius: 90,
                        backgroundColor: c.white,
                    },
                    whiteslide
                ]}
            />

            <Animated.View style={[{ position: "absolute", width: '80%', gap: 20}, LoginTrigger]}>
               
                    <TextInputSplash name={m.username()} type={"text"} setvalue={(text) => setLogininput({ ...logininput, Username: text })} value={logininput.Username} />
                    <TextInputSplash name={m.password()} type={"password"} setvalue={(text) => setLogininput({ ...logininput, Password: text })} value={logininput.Password} />

                    <TouchableOpacity
                        onPress={()=>{navigation.navigate("verifyotp")}}
                    >
                        <Text style={{ alignSelf: 'flex-end' ,color:c.blue}}>{m.forgot_password()}</Text>
                    </TouchableOpacity>
                    {errmsg!=''&&(<Text style={[{ textAlign: 'center',color:c.red,fontWeight:'bold' }]}>{errmsg}</Text>)}
                    <TouchableOpacity
                        style={[Btn.Btn1, { width:'100%'}]}
                        onPress={SubmitLogin}
                    >
                        <Text style={[Btn.textBtn1,{ textAlign: 'center'}]}>{m.Signin()}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={()=>{setlogin(false),setChooseRole(false),setRegister(true)}}
                    >
                        <Text style={{color:c.blue, textAlign: 'center' }}>{m.dont_have_account()}</Text>
                    </TouchableOpacity>

            </Animated.View>
            <Animated.View style={[{ position: "absolute", width: '80%' }, RegisterTrigger] }>
                    {!chooseRole?
                        <Animated.View
                            key="chooseRole"
                            exiting={FadeOut}
                        >
                            <View style={[Layout.columset,{gap:30}]}>
                                <TouchableOpacity
                                    style={[Btn.Btn1,Layout.centerset ,{ width: 200,height:200 }]}
                                    onPress={()=>{setRolesetup("user");setChooseRole(true)}}
                                >  
                                    <Text style={[{ textAlign: 'center' ,justifyContent:'center'},Btn.textBtn1]}>{m.costumer().toUpperCase()}</Text>
                                    <FontAwesome5 name="users" size={70} color={c.fullwhite}/>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[Btn.Btn1, Layout.centerset,{ width: 200,height:200 }]}
                                    onPress={()=>{setRolesetup("vendor");setChooseRole(true)}}
                                >
                                    <Text style={[{ textAlign: 'center',justifyContent:'center'},Btn.textBtn1]}>{m.vendor().toUpperCase()}</Text>
                                    <FontAwesome6 name="shop" size={70} color={c.fullwhite}/>
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    :
                    <Animated.View
                        entering={FadeIn}
                        style={[
                                Layout.centerset,
                                { gap: 13, justifyContent: "space-between" },
                                
                        ]}
                    >
                        <TextInputSplash name={m.email()} type={"email"} setvalue={(text) => setRegisterinput({ ...registerinput, Email: text })} value={registerinput.Email} />
                        <TextInputSplash name={m.username()} type={"text"} setvalue={(text) => setRegisterinput({ ...registerinput, Username: text })} value={registerinput.Username} />
                        <TextInputSplash name={m.password()} type={"password"} setvalue={(text) => setRegisterinput({ ...registerinput, Password: text })} value={registerinput.Password} />
                        <TextInputSplash name={m.confrimpassword()} type={"password"} setvalue={(text) => setRegisterinput({ ...registerinput, ConfirmPassword: text })} value={registerinput.ConfirmPassword} />
                        {errmsg!=''&&(<Text style={[{ textAlign: 'center',color:c.red,fontWeight:'bold' }]}>{errmsg}</Text>)}
                        <TouchableOpacity
                            style={[Btn.Btn1, { width: '100%' }]}
                            onPress={SubmitRegister}
                        >
                            <Text style={[{ textAlign: 'center'},Btn.textBtn1]}>{m.Signup()}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={()=>{setRegister(false),setlogin(true)}}
                        >   
                            <Text style={{fontWeight:"bold",color:c.blue}}>{m.have_account()}</Text>
                        </TouchableOpacity>
                    </Animated.View>
                    }
            </Animated.View>
            {Auth.loading&&(<Loading/>)}
        </SafeAreaView>
    );
};
export default Splash;
