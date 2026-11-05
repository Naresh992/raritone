import {useEffect} from "react";
import {ActivityIndicator, View} from "react-native";
import {Redirect} from "expo-router";
import {useAuth} from "../src/auth/AuthProvider";
import {theme} from "../src/theme";
export default function Index(){const{loading,token}=useAuth();if(!loading)return <Redirect href={token?"/(tabs)":"/welcome"}/>;return <View style={{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:theme.color.paper}}><ActivityIndicator color={theme.color.teal}/></View>}
