import { useEffect } from "react";
import { router, useSegments } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "../contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedUserTypes?: string[];
}

function getRouteByUserType(userType?: string) {
  switch (userType) {
    case "pf":
      return "/(pf-tabs)/home";
    case "comercial":
    case "grande":
      return "/(gerador)/dashboard";
    case "catador":
      return "/(catador)/homecat";
    case "cooperativa":
      return "/(cooperativa)/home";
    default:
      return "/(public)/access-type";
  }
}

export default function ProtectedRoute({
  children,
  allowedUserTypes = [],
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const currentGroup = segments[0];

    if (!user) {
      const isPublicRoute =
        currentGroup === "(public)" || currentGroup === "(auth)";

      if (!isPublicRoute) {
        router.replace("/(public)/access-type");
      }

      return;
    }

    if (
      allowedUserTypes.length > 0 &&
      !allowedUserTypes.includes(user.userType)
    ) {
      router.replace(getRouteByUserType(user.userType));
    }
  }, [user, loading, segments, allowedUserTypes]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#FFFFFF",
        }}
      >
        <ActivityIndicator size="large" color="#028C56" />
      </View>
    );
  }

  if (!user) return null;

  if (
    allowedUserTypes.length > 0 &&
    user?.userType &&
    !allowedUserTypes.includes(user.userType)
  ) {
    return null;
  }

  return <>{children}</>;
}