import { Text, View, TouchableOpacity, Keyboard, TouchableWithoutFeedback  } from "react-native";
import { useEffect, useState } from "react";
import { TEXTinput, TextInputSplash } from "../components/TextInput";
import Loading from "./Loading";

import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withDelay,
    withSequence,
    withTiming, useAnimatedReaction,
    Easing, cubicBezier, useAnimatedKeyboard
} from "react-native-reanimated";
import { Layout } from "../components/Layout";
import { BaseColor as c } from "../components/Color";
import { SafeAreaView } from "react-native-safe-area-context";
import { Btn } from "../components/Button";
import { useDispatch,useSelector } from "react-redux";
import { loginUser,registerID } from "../redux/actions/authAction";
import { getProfile } from "../redux/actions/authAction";
const Splash = ({ navigation }) => {
    
  
    //AUTH TEST
    const Dispath = useDispatch();
    const Auth = useSelector((state) => state.auth); 
    const CheckAuth =()=>{
        console.log("Loading Auth");
        if (!Auth.user || Auth.loading) return;

        if (!Auth.verified){
            navigation.replace("verifyotp")
        }else if (Auth.role==="user") {
            navigation.replace("HomeUser")
        }else if (Auth.role==="vendor") {
            navigation.replace("HomeVendor")
        }
    }


    useEffect(() => {
    if (Auth.user) {
        console.log("USER:", Auth.user);
        //Dispath(getProfile()); 
        CheckAuth(); 
    }
    }, [Auth.user]);
    //AUTH TEST

    //AnimationSet
    const keyboard = useAnimatedKeyboard();
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
                duration: 1000,
                easing: Easing.bounce,
            })
        );

        xOpen.value = withSequence(
            withDelay(500, withTiming(-200)),
            withTiming(0, {
                duration: 1200,
                easing: Easing.out(Easing.exp),
            })
        );

        scOpen.value = withSequence(
            withDelay(1400, withTiming(1)),
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
            withDelay(1800, withTiming(0)),
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
                    duration: 2000,
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
    }, [isToggled]);

    useEffect(() => {
        yLoginHead.value = login ? 0 : 2;
        whitebar.value = isToggled ? 250 : 900;
        yLogin.value = login ? 90 : 600;
        
        login&&(setRegisterinput({
            Email: "",
            Username: "",
            Password: "",
            ConfirmPassword: "",
        }),
        setErrmsg("")
        )
    }, [login]);

    useEffect(() => {
        yRegisterHead.value = register ? 0 : 2;
        whitebar.value = isToggled ? 200 : 900;
        yRegister.value = register ? 90 : 700;

        register&&(setLogininput({
            Username: "",
            Password: "",
        }),
        setErrmsg("")
        )
    }, [register]);

    useEffect(() => {
        bounceAndSlide();
        WelcomeSlice();
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
                whitebar.value = 230
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
            return setErrmsg("your must fill information")
        }
        Dispath(loginUser({
            Username:logininput.Username,
            Password:logininput.Password,
        }))
    }
    const SubmitRegister=()=>{
        setErrmsg("")
        if(registerinput.Email==="" || registerinput.Username==="" ||  registerinput.Password==="" || registerinput.ConfirmPassword===""){
            return setErrmsg("your must fill information")
        }
        
        if(registerinput.Password != registerinput.ConfirmPassword){
            return setErrmsg("Password Not Match")
        }
        if(registerinput.Username.length<5){
            return setErrmsg("User must be than 5 character")
        }
        if(registerinput.Password.length<8 && registerinput.Password.length<8){
            return setErrmsg("password must be than 8")
        }

        Dispath(registerID({
            Email:registerinput.Email,
            Username:registerinput.Username,
            Password:registerinput.Password,
        }))
    }

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
    
    if(Auth.loading){
        return <Loading/>
    }
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
                <View style={[{ flex: 1, justifyContent: "center" }]}>
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
                    <Text style={{ fontSize: 16, color: c.fullwhite, fontWeight: "bold" }}>
                        แอพสั่งอาหารสำหรับคุณ
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
                                <Text style={Btn.textBtn2}>Register</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[Btn.Btn2, { width: "45%" }]}
                                onPress={() => {
                                    setIsToggled(opacityOpen&&(!login));
                                    setlogin(opacityOpen&&(!login));
                                    setRegister(false) 
                                }}
                            >
                                <Text style={Btn.textBtn2}>Login</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </Animated.View>

            <Animated.View style={[{ position: "absolute", top: 100 }, LoginTriggerHead]}>
                <Text style={{ fontSize: 60, fontWeight: 'bold', color: c.fullwhite }}>LOGIN</Text>
            </Animated.View>
            <Animated.View style={[{ position: "absolute", top: 100 }, RegisterTriggerHead]}>
                <Text style={{ fontSize: 60, fontWeight: 'bold', color: c.fullwhite }}>REGISTER</Text>
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

            <Animated.View style={[{ position: "absolute", width: '80%' }, LoginTrigger]}>
                <View
                    style={[
                        Layout.centerset,
                        { gap: 20, justifyContent: "space-between" },
                    ]}
                >

                    <TextInputSplash name={"Username"} setvalue={(text) => setLogininput({ ...logininput, Username: text })} value={logininput.Username} />
                    <TextInputSplash name={"Password"} setvalue={(text) => setLogininput({ ...logininput, Password: text })} value={logininput.Password} />

                    <Text style={{ alignSelf: 'flex-end' }}>ForgotPassword</Text>
                    {errmsg!=''&&(<Text style={[{ textAlign: 'center',color:c.red,fontWeight:'bold' }]}>{errmsg}</Text>)}
                    <TouchableOpacity
                        style={[Btn.Btn1, { width: '100%' }]}
                        onPress={SubmitLogin}
                    >
                        <Text style={{ textAlign: 'center' }}>SignIn</Text>
                    </TouchableOpacity>
                    <Text>You dont have user</Text>
                </View>

            </Animated.View>
            <Animated.View style={[{ position: "absolute", width: '80%' }, RegisterTrigger]}>
                <View
                    style={[
                        Layout.centerset,
                        { gap: 13, justifyContent: "space-between" },
                    ]}
                >
                    <TextInputSplash name={"Email"} setvalue={(text) => setRegisterinput({ ...registerinput, Email: text })} value={registerinput.Email} />
                    <TextInputSplash name={"Username"} setvalue={(text) => setRegisterinput({ ...registerinput, Username: text })} value={registerinput.Username} />
                    <TextInputSplash name={"Password"} setvalue={(text) => setRegisterinput({ ...registerinput, Password: text })} value={registerinput.Password} />
                    <TextInputSplash name={"ConfrimPassword"} setvalue={(text) => setRegisterinput({ ...registerinput, ConfirmPassword: text })} value={registerinput.ConfirmPassword} />
                    {errmsg!=''&&(<Text style={[{ textAlign: 'center',color:c.red,fontWeight:'bold' }]}>{errmsg}</Text>)}
                    <TouchableOpacity
                        style={[Btn.Btn1, { width: '100%' }]}
                        onPress={SubmitRegister}
                    >
                        <Text style={{ textAlign: 'center' }}>SignIn</Text>
                    </TouchableOpacity>
                    <Text>You dont have user</Text>
                </View>
            </Animated.View>
            {Auth.loading&&(<Loading/>)}
        </SafeAreaView>
    );
};
export default Splash;
