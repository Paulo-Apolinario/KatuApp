import { useEffect } from "react";
import { router, useSegments } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "../contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedUserTypes?: string[];
}

function getRouteByRole(role?: string) {
  switch (role) {
    case "PF":
      return "/(pf-tabs)/home";
    case "GENERATOR_SMALL":
    case "GENERATOR_LARGE":
      return "/(gerador)/dashboard";
    case "COLLECTOR":
      return "/(catador)/homecat";
    case "COOPERATIVE":
      return "/(cooperativa)/home";
    default:
      return "/(public)/access-type";
  }
}

function mapAllowedTypesToRoles(types: string[]) {
  return types.map((type) => {
    switch (type) {
      case "pf":
        return "PF";
      case "comercial":
        return "GENERATOR_SMALL";
      case "grande":
        return "GENERATOR_LARGE";
      case "catador":
        return "COLLECTOR";
      case "cooperativa":
        return "COOPERATIVE";
      default:
        return type;
    }
  });
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

    const allowedRoles = mapAllowedTypesToRoles(allowedUserTypes);

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      router.replace(getRouteByRole(user.role));
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

  const allowedRoles = mapAllowedTypesToRoles(allowedUserTypes);

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
