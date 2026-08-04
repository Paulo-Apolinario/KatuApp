import React, { useEffect, useMemo } from "react";
import { router, useSegments } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedUserTypes?: string[];
}

function normalizeRole(role?: string | null) {
  return String(role || "").trim().toUpperCase();
}

function getRouteByRole(role?: string | null) {
  const normalized = normalizeRole(role);

  switch (normalized) {
    case "PF":
      return "/(pf-tabs)/home";
    case "GENERATOR_SMALL":
    case "GENERATOR_LARGE":
      return "/(gerador)/dashboard";
    case "COLLECTOR":
      return "/(catador)/homecat";
    case "COOPERATIVE":
      return "/(cooperativa)/home";
    case "DRIVER":
      return "/(motorista)/home";
    default:
      return "/(public)/access-type";
  }
}

function mapAllowedTypesToRoles(types: string[]) {
  return types.map((type) => {
    const normalized = String(type || "").trim().toLowerCase();

    switch (normalized) {
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
      case "motorista":
        return "DRIVER";
      default:
        return normalizeRole(type);
    }
  });
}

export default function ProtectedRoute({
  children,
  allowedUserTypes = [],
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const segments = useSegments();

  const currentGroup = segments[0];

  const allowedRoles = useMemo(
    () => mapAllowedTypesToRoles(allowedUserTypes),
    [allowedUserTypes]
  );

  const userRole = normalizeRole(user?.role);

  useEffect(() => {
    if (loading) return;

    const isPublicRoute =
      currentGroup === "(public)" || currentGroup === "(auth)";

    if (!user) {
      if (!isPublicRoute) {
        router.replace("/(public)/access-type");
      }

      return;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
      router.replace(getRouteByRole(userRole));
    }
  }, [user, userRole, loading, currentGroup, allowedRoles]);

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

  if (!user) {
    return null;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    return null;
  }

  return <>{children}</>;
}