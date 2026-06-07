import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import TeacherLayout from "../components/teacher/TeacherLayout";
import { Crown, Calendar, CreditCard, AlertCircle, Loader2, CheckCircle } from "lucide-react";

export default function TeacherSettings() {
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [priceIds, setPriceIds] = useState(null);
  const [trialProgress, setTrialProgress] = useState({ daysLeft: 0, totalDays: 7, percentage: 0 });

  useEffect(() => {
    loadTeacherData();
    loadPriceIds();
  }, []);

  const loadTeacherData = async () => {
   try {
     const currentUser = await quest.auth.me();
     setTeacher(currentUser);

     // Calculate trial or grace period progress.
     // Trial = 7-day free trial. Grace period = 30 days post-conversion.
     const endDate = currentUser.trial_end_date || currentUser.grace_period_end_date;
     if (endDate) {
       const now = new Date();
       const end = new Date(endDate);
       const daysLeft = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
       const totalDays = currentUser.subscription_status === 'grace_period' ? 30 : 7;
       const percentage = Math.max(0, Math.min(100, (daysLeft / totalDays) * 100));
       setTrialProgress({ daysLeft, totalDays, percentage });
     }

     setLoading(false);
   } catch (err) {
     console.error("Failed to load teacher data:", err);
     setLoading(false);
   }
  };

  const loadPriceIds = async () => {
    try {
      const response = await quest.functions.invoke('getStripePrices');
      setPriceIds(response.data);
    } catch (err) {
      console.error("Failed to load price IDs:", err);
    }
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      // Check if running in iframe (preview mode)
      if (window.self !== window.top) {
        alert("Please open the published app to complete checkout");
        setUpgrading(false);
        return;
      }

      // Create checkout session for Premium plan
      if (!priceIds?.premium_price_id) {
        alert("Stripe products not configured. Please contact support.");
        setUpgrading(false);
        return;
      }

      const response = await quest.functions.invoke('createCheckout', {
        priceId: priceIds.premium_price_id,
        successUrl: `${window.location.origin}${createPageUrl('TeacherSettings')}?checkout=success`,
        cancelUrl: window.location.href,
      });

      if (response.data.url) {
        window.location.href = response.data.url;
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("Failed to start checkout. Please try again.");
      setUpgrading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const response = await quest.functions.invoke('stripePortal');
      if (response.data.url) {
        window.open(response.data.url, '_blank');
      }
    } catch (error) {
      console.error("Failed to open billing portal:", error);
      alert("Failed to open billing portal. Please try again.");
    }
  };

  const getTrialDaysRemaining = () => {
   const endDate = teacher?.trial_end_date || teacher?.grace_period_end_date;
   if (!endDate) return 0;
   const end = new Date(endDate);
   const now = new Date();
   const diffTime = end - now;
   const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
   return diffDays > 0 ? diffDays : 0;
  };

  const handleSignOut = () => {
    quest.auth.logout();
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const subscriptionStatus = teacher?.subscription_status || 'free';
  
  // Treat null, undefined, or 'basic' as 'free' for UI purposes
  const effectiveStatus = (!subscriptionStatus || subscriptionStatus === 'basic') ? 'free' : subscriptionStatus;
  const trialDaysRemaining = getTrialDaysRemaining();

  return (
    <TeacherLayout activeNav="settings" user={teacher} onSignOut={handleSignOut}>
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-black mb-1">Settings</h1>
          <p className="text-sm text-gray-600">Manage your account and subscription</p>
        </div>

        {/* Account Information */}
        <Card className="border border-gray-200 mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Name</p>
              <p className="text-base font-medium text-black">{teacher?.full_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="text-base font-medium text-black">{teacher?.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Account Type</p>
              <p className="text-base font-medium text-black capitalize">
                {teacher?.new_role === "tutor"
                  ? "Tutor"
                  : teacher?.account_type}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Status */}
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg">Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            {effectiveStatus === 'free' && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-blue-900 mb-1">Basic Plan (Free)</p>
                    <p className="text-sm text-blue-700">
                      You're currently on the basic plan with access to live sessions only.
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-3">Features included:</p>
                  <ul className="space-y-2 text-sm text-gray-700 mb-4">
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                      Access to live learning sessions
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                      Basic progress tracking
                    </li>
                  </ul>
                  <Button 
                    onClick={handleUpgrade}
                    disabled={upgrading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {upgrading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Crown className="w-4 h-4 mr-2" />
                        Upgrade to Premium
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {(effectiveStatus === 'trial' || effectiveStatus === 'grace_period') && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <Calendar className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-purple-900 mb-1">{subscriptionStatus === 'grace_period' ? 'Grace Period' : 'Premium Trial'}</p>
                    <p className="text-sm text-purple-700">
                      {trialDaysRemaining > 0 
                        ? `${trialDaysRemaining} days remaining ${subscriptionStatus === 'grace_period' ? 'to use your subscription' : 'in your free trial'}`
                        : "Your access period has ended"}
                    </p>
                  </div>
                </div>
                
                {/* Trial / Grace-period progress bar */}
                <div className="p-4 bg-white rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-700">
                      {subscriptionStatus === 'grace_period' ? 'Subscription Period' : 'Trial Period'}
                    </span>
                    <span className="text-sm font-bold text-purple-600">
                      {trialProgress.daysLeft} of {trialProgress.totalDays} days left
                    </span>
                  </div>
                  <Progress value={trialProgress.percentage} className="h-2.5" />
                  <p className="text-xs text-gray-500 mt-2">
                    {subscriptionStatus === 'grace_period'
                      ? `Your subscription period renews in ${trialProgress.daysLeft} days`
                      : `Your trial will automatically convert to a paid subscription after ${trialProgress.daysLeft} days`}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-3">Premium features:</p>
                  <ul className="space-y-2 text-sm text-gray-700 mb-4">
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-purple-600 rounded-full"></div>
                      Unlimited live sessions
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-purple-600 rounded-full"></div>
                      AI-generated curriculum
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-purple-600 rounded-full"></div>
                      Full class management
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-purple-600 rounded-full"></div>
                      Advanced analytics
                    </li>
                  </ul>
                  <Button 
                    onClick={handleManageSubscription}
                    variant="outline"
                    className="w-full"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Manage Subscription
                  </Button>
                </div>
              </div>
            )}

            {effectiveStatus === 'premium' && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                  <Crown className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-green-900 mb-1">Premium Active</p>
                    <p className="text-sm text-green-700">
                      You have full access to all Quest Learning features
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-3">Premium features:</p>
                  <ul className="space-y-2 text-sm text-gray-700 mb-4">
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                      Unlimited live sessions
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                      AI-generated curriculum
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                      Full class management
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                      Advanced analytics
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                      Priority support
                    </li>
                  </ul>
                  <Button 
                    onClick={handleManageSubscription}
                    variant="outline"
                    className="w-full"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Manage Subscription & Billing
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TeacherLayout>
  );
}