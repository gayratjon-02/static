// =============================================
// useAuth — Token-based auth hook
// =============================================

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import type { Member } from "../types/member.type";

const TOKEN_KEY = "se_access_token";
const MEMBER_KEY = "se_member";
const PUBLIC_ROUTES = ["/login", "/homepage", "/"];

export function useAuth() {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [member, setMember] = useState<Member | null>(null);
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem(TOKEN_KEY);
        const stored = localStorage.getItem(MEMBER_KEY);

        if (token && stored) {
            setIsAuthenticated(true);
            setMember(JSON.parse(stored));
        } else {
            setIsAuthenticated(false);
            if (!PUBLIC_ROUTES.includes(router.pathname) && !router.pathname.startsWith("/_admin")) {
                router.replace("/login");
            }
        }
    }, [router.pathname]);

    /** Save auth data after login/signup */
    const login = (accessToken: string, memberData: Member) => {
        localStorage.setItem(TOKEN_KEY, accessToken);
        localStorage.setItem(MEMBER_KEY, JSON.stringify(memberData));
        setIsAuthenticated(true);
        setMember(memberData);
    };

    /** Clear auth data and redirect to login */
    const logout = () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(MEMBER_KEY);
        setIsAuthenticated(false);
        setMember(null);
        router.replace("/login");
    };

    /** Get stored access token */
    const getToken = (): string | null => {
        return localStorage.getItem(TOKEN_KEY);
    };

    return { isAuthenticated, member, login, logout, getToken };
}
