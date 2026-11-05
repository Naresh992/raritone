import {Feather} from "@expo/vector-icons";
import {Tabs} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {theme} from "../../src/theme";
const icons={index:"home", "try-on":"aperture", wardrobe:"shopping-bag", looks:"image", profile:"user"} as const;
const labels={index:"Home", "try-on":"Try-on", wardrobe:"Wardrobe", looks:"Looks", profile:"Profile"} as const;
export default function TabLayout(){const inset=useSafeAreaInsets();return <Tabs screenOptions={({route})=>({headerShown:false,tabBarActiveTintColor:theme.color.teal,tabBarInactiveTintColor:theme.color.muted,tabBarStyle:{height:58+Math.max(10,inset.bottom),paddingTop:7,paddingBottom:Math.max(10,inset.bottom),backgroundColor:theme.color.paper,borderTopColor:theme.color.line,elevation:0},tabBarLabelStyle:{fontSize:10,marginTop:2},tabBarIcon:({color,size})=><Feather name={icons[route.name as keyof typeof icons]||"circle"} size={size} color={color}/>})}><Tabs.Screen name="index" options={{title:labels.index}}/><Tabs.Screen name="try-on" options={{title:labels["try-on"]}}/><Tabs.Screen name="wardrobe" options={{title:labels.wardrobe}}/><Tabs.Screen name="looks" options={{title:labels.looks}}/><Tabs.Screen name="profile" options={{title:labels.profile}}/></Tabs>}
