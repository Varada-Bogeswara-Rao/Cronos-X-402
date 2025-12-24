"use client";

import React, { useEffect, useRef } from 'react';
import Spline from '@splinetool/react-spline';
import { ArrowRight } from "lucide-react";

function HeroSplineBackground() {
    return (
        <div style={{
            position: 'relative',
            width: '100%',
            height: '100vh',
            pointerEvents: 'auto',
            overflow: 'hidden',
        }}>
            <Spline
                style={{
                    width: '100%',
                    height: '100vh',
                    pointerEvents: 'auto',
                }}
                scene="https://prod.spline.design/dJqTIQ-tE3ULUPMi/scene.splinecode"
            />
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100vh',
                    background: `
            linear-gradient(to right, rgba(0, 0, 0, 0.8), transparent 30%, transparent 70%, rgba(0, 0, 0, 0.8)),
            linear-gradient(to bottom, transparent 50%, rgba(0, 0, 0, 0.9))
          `,
                    pointerEvents: 'none',
                }}
            />
        </div>
    );
}

function HeroContent() {
    return (
        <div className="text-white px-4 max-w-screen-xl mx-auto w-full flex flex-col lg:flex-row justify-between items-start lg:items-center py-16">

            <div className="w-full lg:w-1/2 pr-0 lg:pr-8 mb-8 lg:mb-0">
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 leading-tight tracking-wide">
                    Future of<br />Crypto Payments
                </h1>
                <div className="text-sm text-gray-300 opacity-90 mt-4 font-mono">
                    WEB3 \ PAYMENTS \ AI \ DEFI
                </div>
            </div>

            <div className="w-full lg:w-1/2 pl-0 lg:pl-8 flex flex-col items-start">
                <p className="text-base sm:text-lg opacity-80 mb-6 max-w-md">
                    Seamlessly integrate Cronos payments into your applications. Fast, secure, and developer-friendly.
                </p>
                <div className="flex pointer-events-auto mt-6">
                    <a href="/dashboard" className="bg-white text-black font-semibold py-3 px-8 rounded-full transition duration-300 hover:scale-105 flex items-center justify-center hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                        Get Started
                        <ArrowRight className="w-5 h-5 ml-2" />
                    </a>
                </div>
            </div>

        </div>
    );
}

const HeroSection = () => {
    const heroContentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleScroll = () => {
            if (heroContentRef.current) {
                requestAnimationFrame(() => {
                    const scrollPosition = window.pageYOffset;
                    const maxScroll = 400;
                    const opacity = 1 - Math.min(scrollPosition / maxScroll, 1);
                    if (heroContentRef.current) {
                        heroContentRef.current.style.opacity = opacity.toString();
                    }
                });
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="relative">
            <div className="relative min-h-screen">
                <div className="absolute inset-0 z-0 pointer-events-auto">
                    <HeroSplineBackground />
                </div>

                <div ref={heroContentRef} style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100vh',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10, pointerEvents: 'none'
                }}>
                    <HeroContent />
                </div>
            </div>

            <div className="bg-black relative z-10" style={{ marginTop: '-10vh' }}>
                <div className="container mx-auto px-4 py-16 text-white text-center">
                    <h2 className="text-4xl font-bold mb-4">Accept Payments in Minutes</h2>
                    <p className="max-w-xl mx-auto opacity-80 mb-8">
                        Our SDK handles everything from wallet connection to transaction verification.
                        Focus on building your product, we handle the crypto.
                    </p>
                </div>
            </div>
        </div>
    );
};

export { HeroSection }
