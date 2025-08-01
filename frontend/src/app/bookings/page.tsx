"use client";
import React, { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import { useAuth } from "../../hooks/useAuth";
import ChatBox from "../../components/ChatBox";
import GuestCancellationForm from "../../components/GuestCancellationForm";
import PrivacyMap from "../../components/PrivacyMap";
import { useRouter } from "next/navigation";
import LoadingPage from "../../components/LoadingPage";

interface Booking {
  id: string;
  listing_id: string;
  guest_id: string;
  host_id: string;
  start_date: string;
  end_date: string;
  price_per_night: number;
  total_price: number;
  status: string;
  payment_status: string;
}

interface Listing {
  id: string;
  title: string;
  city: string;
  state: string;
  description: string;
  images: { url: string }[];
  price_per_night: number;
  user_id: string; // Added for host
  latitude?: number;
  longitude?: number;
  neighborhood?: string;
}

export default function BookingsPage() {
  const { user } = useAuth();
  const userId = typeof user?.id === 'string' ? user.id : null;
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState<Listing | null>(null);
  const [host, setHost] = useState<any | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Review popup state
  const [showReviewPopup, setShowReviewPopup] = useState(false);
  const [currentReviewStep, setCurrentReviewStep] = useState(0);
  const [reviewData, setReviewData] = useState({
    cleanliness_rating: 0,
    accuracy_rating: 0,
    communication_rating: 0,
    location_rating: 0,
    value_rating: 0,
    comment: ''
  });
  const [reviewingBooking, setReviewingBooking] = useState<Booking | null>(null);
  const [existingReview, setExistingReview] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [reviewedBookings, setReviewedBookings] = useState<Set<string>>(new Set());

  // Cancellation form state
  const [showCancellationForm, setShowCancellationForm] = useState(false);
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);
  const [cancellationLoading, setCancellationLoading] = useState(false);

  const reviewSteps = [
    { title: 'Cleanliness', field: 'cleanliness_rating', description: 'How clean was the space?' },
    { title: 'Accuracy', field: 'accuracy_rating', description: 'How accurate was the listing description?' },
    { title: 'Communication', field: 'communication_rating', description: 'How well did the host communicate?' },
    { title: 'Location', field: 'location_rating', description: 'How was the location?' },
    { title: 'Value', field: 'value_rating', description: 'How good was the value for money?' }
  ];

  const handleReviewStep = (rating: number) => {
    const currentField = reviewSteps[currentReviewStep].field as keyof typeof reviewData;
    setReviewData(prev => ({ ...prev, [currentField]: rating }));
    
    if (currentReviewStep < reviewSteps.length - 1) {
      setCurrentReviewStep(prev => prev + 1);
    } else {
      // Move to comment step
      setCurrentReviewStep(5);
    }
  };

  const handleBackStep = () => {
    if (currentReviewStep > 0) {
      setCurrentReviewStep(prev => prev - 1);
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewingBooking || !user) return;

    try {
      let response;
      
      if (isEditing && existingReview) {
        // Update existing review
        response = await fetch(`http://localhost:4000/api/host-reviews/${existingReview.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reviewer_id: user.id,
            ...reviewData
          })
        });
      } else {
        // Create new review
        response = await fetch('http://localhost:4000/api/host-reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            booking_id: reviewingBooking.id,
            reviewer_id: user.id,
            reviewee_id: reviewingBooking.host_id,
            ...reviewData
          })
        });
      }

      if (response.ok) {
        alert(isEditing ? 'Review updated successfully!' : 'Review submitted successfully!');
        setShowReviewPopup(false);
        setCurrentReviewStep(0);
        setReviewData({
          cleanliness_rating: 0,
          accuracy_rating: 0,
          communication_rating: 0,
          location_rating: 0,
          value_rating: 0,
          comment: ''
        });
        setReviewingBooking(null);
        setExistingReview(null);
        setIsEditing(false);
        
        // Update reviewed bookings state
        if (!isEditing && reviewingBooking) {
          setReviewedBookings(prev => new Set([...prev, reviewingBooking.id]));
        }
      } else {
        const error = await response.json();
        alert(`Failed to ${isEditing ? 'update' : 'submit'} review: ${error.error}`);
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      alert(`Failed to ${isEditing ? 'update' : 'submit'} review. Please try again.`);
    }
  };

  const openReviewPopup = async (booking: Booking) => {
    setReviewingBooking(booking);
    setShowReviewPopup(true);
    setCurrentReviewStep(0);
    setIsEditing(false);
    setExistingReview(null);

    // Check if user has already written a review for this booking
    if (user) {
      try {
        const response = await fetch(`http://localhost:4000/api/host-reviews`);
        if (response.ok) {
          const allReviews = await response.json();
          const userReview = allReviews.find((review: any) => 
            review.booking_id === booking.id && 
            review.reviewer_id === user.id &&
            review.reviewee_id === booking.host_id
          );
          
          if (userReview) {
            setExistingReview(userReview);
            setIsEditing(true);
            setReviewData({
              cleanliness_rating: userReview.cleanliness_rating,
              accuracy_rating: userReview.accuracy_rating,
              communication_rating: userReview.communication_rating,
              location_rating: userReview.location_rating,
              value_rating: userReview.value_rating,
              comment: userReview.comment || ''
            });
          } else {
            setReviewData({
              cleanliness_rating: 0,
              accuracy_rating: 0,
              communication_rating: 0,
              location_rating: 0,
              value_rating: 0,
              comment: ''
            });
          }
        }
      } catch (error) {
        console.error('Error checking existing review:', error);
        setReviewData({
          cleanliness_rating: 0,
          accuracy_rating: 0,
          communication_rating: 0,
          location_rating: 0,
          value_rating: 0,
          comment: ''
        });
      }
    }
  };

  const handleCancelBooking = (booking: Booking) => {
    setCancellingBooking(booking);
    setShowCancellationForm(true);
  };

  const handleCancellationSubmit = async (reason: string, details: string) => {
    if (!cancellingBooking) return;

    setCancellationLoading(true);
    try {
      const response = await fetch(`http://localhost:4000/api/bookings/${cancellingBooking.id}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cancellation_reason: reason,
          cancellation_details: details
        })
      });

      if (response.ok) {
        alert('Booking cancelled successfully!');
        // Update the booking status in the local state
        setBookings(prev => prev.map(b => 
          b.id === cancellingBooking.id ? { ...b, status: 'cancelled' } : b
        ));
        // Clear the selected booking if it was the cancelled one
        if (selected?.id === cancellingBooking.id) {
          setSelected(null);
        }
        setShowCancellationForm(false);
        setCancellingBooking(null);
      } else {
        const error = await response.json();
        alert(`Failed to cancel booking: ${error.error}`);
      }
    } catch (error) {
      console.error('Error cancelling booking:', error);
      alert('Failed to cancel booking. Please try again.');
    } finally {
      setCancellationLoading(false);
    }
  };

  const handleCancellationClose = () => {
    setShowCancellationForm(false);
    setCancellingBooking(null);
    setCancellationLoading(false);
  };

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`http://localhost:4000/api/bookings/user/${userId}`)
      .then(res => res.json())
      .then(data => {
        setBookings(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setBookings([]);
        setLoading(false);
      });
  }, [userId]);

  // Fetch user's existing reviews to track which bookings have been reviewed
  useEffect(() => {
    if (!userId) return;
    fetch('http://localhost:4000/api/host-reviews')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const userReviews = data.filter((review: any) => review.reviewer_id === userId);
          const reviewedBookingIds = new Set(userReviews.map((review: any) => review.booking_id));
          setReviewedBookings(reviewedBookingIds);
        }
      })
      .catch(() => setReviewedBookings(new Set()));
  }, [userId]);

  // Filter bookings by status
  const pendingBookings = bookings.filter(b => b.status === 'pending');
  const approvedBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'approved');
  const completedBookings = bookings.filter(b => b.status === 'ended');
  const cancelledBookings = bookings.filter(b => b.status === 'cancelled');

  // Fetch listing and host for selected booking
  useEffect(() => {
    if (!selected) {
      setListing(null);
      setHost(null);
      return;
    }
    fetch(`http://localhost:4000/api/listings/${selected.listing_id}`)
      .then(res => res.json())
      .then(data => {
        setListing(data);
        if (data.user_id) {
          fetch(`http://localhost:4000/api/users/${data.user_id}`)
            .then(res => res.json())
            .then(user => setHost(user))
            .catch(() => setHost(null));
        } else {
          setHost(null);
        }
      })
      .catch(() => {
        setListing(null);
        setHost(null);
      });
  }, [selected]);

  // Reset image index when selected booking changes
  useEffect(() => {
    setCurrentImageIndex(0);
  }, [selected]);

  const router = useRouter();

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-50 overflow-hidden">
      <Navbar />
      <div className="flex flex-1 mt-25 overflow-hidden">
        {/* Review Popup and Blur */}
        {showReviewPopup && (
          <>
            {/* Blur the center and right columns */}
            <div className="absolute inset-0 z-30 flex">
              <div className="w-80" />
              <div className="flex-1 flex">
                <div className="flex-1 backdrop-blur-sm bg-black/20" />
                <div className="w-96 backdrop-blur-sm bg-black/20" />
              </div>
            </div>
            {/* Popup */}
            <div className="absolute left-80 top-0 z-40 flex justify-center items-center w-[calc(100%-20rem)] h-full">
              <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-auto flex flex-col items-center">
                {currentReviewStep < reviewSteps.length ? (
                  <>
                    <h2 className="text-xl font-bold mb-2">{reviewSteps[currentReviewStep].title}</h2>
                    <p className="text-gray-600 mb-4">{reviewSteps[currentReviewStep].description}</p>
                    <div className="flex gap-2 mb-6">
                      {[1,2,3,4,5].map(star => (
                        <button
                          key={star}
                          className={`text-3xl ${Number(reviewData[reviewSteps[currentReviewStep].field as keyof typeof reviewData]) >= star ? 'text-yellow-400' : 'text-gray-300'}`}
                          onClick={() => handleReviewStep(star)}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    <button
                      className="text-sm text-blue-600 hover:underline mb-2"
                      onClick={handleBackStep}
                      disabled={currentReviewStep === 0}
                    >
                      Back
                    </button>
                  </>
                ) : (
                  <>
                    <h2 className="text-xl font-bold mb-2">Write a Comment</h2>
                    <textarea
                      className="w-full border rounded-lg p-2 mb-4"
                      rows={4}
                      placeholder="Share your experience..."
                      value={reviewData.comment}
                      onChange={e => setReviewData(prev => ({ ...prev, comment: e.target.value }))}
                    />
                    <div className="flex w-full justify-between">
                      <button
                        className="text-sm text-blue-600 hover:underline"
                        onClick={handleBackStep}
                      >
                        Back
                      </button>
                      <button
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow"
                        onClick={handleSubmitReview}
                      >
                        {isEditing ? 'Update Review' : 'Submit Review'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
        {/* Sidebar */}
        <div className="w-80 border-r border-gray-200 bg-white p-6 flex flex-col overflow-hidden">
          <h2 className="text-xl font-bold mb-4 text-black flex-shrink-0">Your Bookings</h2>
          {loading ? (
            <div className="text-gray-400">Loading...</div>
          ) : bookings.length === 0 ? (
            <div className="text-gray-400">You have no bookings.</div>
          ) : (
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {/* Pending Section */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 text-black">Pending</h3>
                {pendingBookings.length === 0 ? (
                  <div className="text-gray-400">No pending bookings.</div>
                ) : (
                  <ul className="space-y-2">
                    {pendingBookings.map((booking) => (
                      <li
                        key={booking.id}
                        className={`rounded-lg p-3 cursor-pointer transition border border-gray-100 hover:bg-gray-100 ${selected?.id === booking.id ? "bg-blue-50 border-blue-400" : ""}`}
                        onClick={() => setSelected(booking)}
                      >
                        <BookingSidebarItem booking={booking} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {/* Approved Section */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3 text-black">Approved</h3>
                {approvedBookings.length === 0 ? (
                  <div className="text-gray-400">No approved bookings.</div>
                ) : (
                  <ul className="space-y-2">
                    {approvedBookings.map((booking) => (
                      <li
                        key={booking.id}
                        className={`rounded-lg p-3 cursor-pointer transition border border-gray-100 hover:bg-gray-100 ${selected?.id === booking.id ? "bg-blue-50 border-blue-400" : ""}`}
                        onClick={() => setSelected(booking)}
                      >
                        <BookingSidebarItem booking={booking} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {/* Completed Section */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3 text-black">Completed</h3>
                {completedBookings.length === 0 ? (
                  <div className="text-gray-400">No completed bookings.</div>
                ) : (
                  <ul className="space-y-2">
                    {completedBookings.map((booking) => (
                      <li
                        key={booking.id}
                        className={`rounded-lg p-3 cursor-pointer transition border border-gray-100 hover:bg-gray-100 ${selected?.id === booking.id ? "bg-blue-50 border-blue-400" : ""}`}
                        onClick={() => setSelected(booking)}
                      >
                        <BookingSidebarItem booking={booking} />
                        <button
                          onClick={e => { e.stopPropagation(); openReviewPopup(booking); }}
                          className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded"
                        >
                          {reviewedBookings.has(booking.id) ? 'Edit Review' : 'Write Review'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {/* Cancelled Section */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3 text-black">Cancelled</h3>
                {cancelledBookings.length === 0 ? (
                  <div className="text-gray-400">No cancelled bookings.</div>
                ) : (
                  <ul className="space-y-2">
                    {cancelledBookings.map((booking) => (
                      <li
                        key={booking.id}
                        className={`rounded-lg p-3 cursor-pointer transition border border-gray-100 hover:bg-gray-100 ${selected?.id === booking.id ? "bg-blue-50 border-blue-400" : ""}`}
                        onClick={() => setSelected(booking)}
                      >
                        <BookingSidebarItem booking={booking} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
        {/* Center: Chat with host */}
        <div className="flex-1 flex flex-col border-r border-gray-200 overflow-hidden">
          {selected && listing && host ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="border-b border-gray-200 px-6 py-3 bg-white flex-shrink-0">
                <div className="flex items-center gap-3">
                  {host?.avatar_url ? (
                    <img src={host.avatar_url} alt={host.name} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-xl font-bold text-gray-700">
                      {host?.name ? host.name[0] : 'H'}
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-lg text-black">
                      {host?.name || "Host"}
                    </div>
                    <div className="text-xs text-gray-500">Boston University student</div>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-hidden p-2">
                <ChatBox
                  listingId={listing.id}
                  hostId={host.id}
                  allowHostChat={true}
                  fullWidth={true}
                  hideHeader={true}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-lg">Select a booking to view messages</div>
          )}
        </div>
        {/* Right: Listing details with Hosted by */}
        <div className="w-96 border-l border-gray-200 bg-white p-6 flex flex-col overflow-hidden">
          {selected && listing && host ? (
            <div className="overflow-y-auto scrollbar-hide">
              <button 
                className="bg-white border border-black text-black px-3 py-1 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm mb-4 w-fit"
                onClick={() => {
                  // Check if user is logged in
                  if (!user) {
                    router.push('/login');
                    return;
                  }
                  router.push(`/listings/${listing.id}`);
                }}
              >
                Listing Page
              </button>
              <div className="font-bold text-lg text-black mb-4">{listing.title}</div>
              {/* Gallery */}
              <div className="relative w-full h-48 mb-6">
                {listing.images && listing.images.length > 0 ? (
                  <>
                    <img
                      src={listing.images[currentImageIndex]?.url.startsWith('/uploads/') ? `http://localhost:4000${listing.images[currentImageIndex].url}` : listing.images[currentImageIndex].url}
                      alt={listing.title}
                      className="w-full h-48 object-cover rounded-xl"
                    />
                    {currentImageIndex > 0 && (
                      <button
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 rounded-full p-1 shadow hover:bg-opacity-100 transition-all"
                        onClick={() => setCurrentImageIndex(currentImageIndex - 1)}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="black" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                    )}
                    {currentImageIndex < listing.images.length - 1 && (
                      <button
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 rounded-full p-1 shadow hover:bg-opacity-100 transition-all"
                        onClick={() => setCurrentImageIndex(currentImageIndex + 1)}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="black" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    )}
                    {/* Image counter */}
                    {listing.images.length > 1 && (
                      <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                        {currentImageIndex + 1} / {listing.images.length}
                      </div>
                    )}
                  </>
                ) : (
                  <img
                    src="https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=800&q=80"
                    alt={listing.title}
                    className="w-full h-48 object-cover rounded-xl"
                  />
                )}
              </div>
              {/* Booking details */}
              <div className="mb-4">
                <div className="font-semibold text-black mb-2">Booking Details</div>
                <div className="text-gray-700 text-sm mb-1">Dates: {formatDate(selected.start_date)} - {formatDate(selected.end_date)}</div>
                <div className="text-gray-700 text-sm">Total price: ${selected.total_price}</div>
                <div className="text-gray-700 text-sm">Status: {selected.status}</div>
                <div className="text-gray-700 text-sm">Payment: {selected.payment_status}</div>
                
                {/* Cancel Booking Button - only show for approved bookings */}
                {selected.status === 'confirmed' && (
                  <button
                    onClick={() => handleCancelBooking(selected)}
                    className="mt-4 px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow"
                  >
                    Cancel Booking
                  </button>
                )}
              </div>
              <div className="font-semibold text-black mb-2">About this place</div>
              <div className="text-gray-700 mb-4">{listing.description}</div>
              <div className="font-semibold text-black mb-2">Location</div>
              <div className="mb-4">
                <PrivacyMap
                  latitude={listing.latitude}
                  longitude={listing.longitude}
                  city={listing.city}
                  state={listing.state}
                  neighborhood={listing.neighborhood}
                  height="200px"
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-lg">Select a booking to view details</div>
          )}
        </div>
      </div>

      {/* Guest Cancellation Form Modal */}
      <GuestCancellationForm
        isOpen={showCancellationForm}
        onClose={handleCancellationClose}
        onSubmit={handleCancellationSubmit}
        isLoading={cancellationLoading}
      />
    </div>
  );
}

function BookingSidebarItem({ booking }: { booking: Booking }) {
  const [listing, setListing] = useState<Listing | null>(null);
  useEffect(() => {
    fetch(`http://localhost:4000/api/listings/${booking.listing_id}`)
      .then(res => res.json())
      .then(data => setListing(data))
      .catch(() => setListing(null));
  }, [booking.listing_id]);
  return (
    <div>
      <div className="font-semibold text-black text-base">{listing?.title || "Listing"}</div>
      <div className="text-xs text-gray-500">{listing?.city}, {listing?.state}</div>
      <div className="text-xs text-gray-500">{formatDate(booking.start_date)} - {formatDate(booking.end_date)}</div>
    </div>
  );
}

function BookingDetailsView({ booking }: { booking: Booking }) {
  const [listing, setListing] = useState<Listing | null>(null);
  useEffect(() => {
    fetch(`http://localhost:4000/api/listings/${booking.listing_id}`)
      .then(res => res.json())
      .then(data => setListing(data))
      .catch(() => setListing(null));
  }, [booking.listing_id]);
  return (
    <div className="w-full min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 mt-8">
        {listing && listing.images && listing.images.length > 0 && (
          <img src={listing.images[0].url.startsWith('/uploads/') ? `http://localhost:4000${listing.images[0].url}` : listing.images[0].url} alt={listing.title} className="rounded-xl w-full h-64 object-cover mb-6" />
        )}
        <div className="font-bold text-2xl text-black mb-1">{listing?.title || "Listing"}</div>
        <div className="text-gray-500 mb-2">{listing?.city}, {listing?.state}</div>
        <div className="text-gray-700 mb-4">{listing?.description}</div>
        <div className="flex items-center text-lg mb-2">
          <span className="font-bold text-black mr-1">${booking.price_per_night}</span>
          <span className="text-gray-500">per night</span>
        </div>
        <div className="text-sm text-gray-500 mb-1">Booking dates: {formatDate(booking.start_date)} - {formatDate(booking.end_date)}</div>
        <div className="text-sm text-gray-500 mb-1">Total price: ${booking.total_price}</div>
        <div className="text-sm text-gray-500 mb-1">Status: {booking.status}</div>
        <div className="text-sm text-gray-500 mb-1">Payment: {booking.payment_status}</div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
} 