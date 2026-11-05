import {Feather} from "@expo/vector-icons";
import {router} from "expo-router";
import {Text,View} from "react-native";
import {Button,Caption,Header,Notice,Page,Title} from "../src/components/ui";
import {theme} from "../src/theme";
export default function Notifications(){return <Page><Header title="Notifications" back onBack={()=>router.back()}/><View style={{alignItems:"center",gap:12,paddingTop:38}}><View style={{width:70,height:70,borderRadius:35,backgroundColor:theme.color.mist,alignItems:"center",justifyContent:"center"}}><Feather name="bell" size={27} color={theme.color.teal}/></View><Title style={{fontSize:24}}>No updates yet</Title><Caption style={{textAlign:"center",maxWidth:290}}>Order and try-on activity will appear here when notification delivery is connected.</Caption></View><Notice>There is no notifications inbox endpoint or push service configured in this repository. This screen intentionally shows no sample alerts.</Notice><Button title="Notification preferences" variant="secondary" onPress={()=>router.push("/settings")}/></Page>}
