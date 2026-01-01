import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { clients } from '../services/api';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  LoadingSpinner,
  Badge,
} from '../components/common';
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

const BUSINESS_INFO_TAB_KEY = 'admin_business_info_tab';

export default function BusinessInfo() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [businessInfo, setBusinessInfo] = useState({
    about_business: '',
    custom_instructions: '',
    business_hours: '',
    contact_phone: '',
    contact_email: '',
    contact_address: '',
    return_policy: '',
    shipping_policy: '',
    payment_methods: '',
    faq: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem(BUSINESS_INFO_TAB_KEY) || 'about';
  });

  // Persist active tab to localStorage
  useEffect(() => {
    localStorage.setItem(BUSINESS_INFO_TAB_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load client info
      const clientData = await clients.getById(id);
      setClient(clientData.data);

      // Load business info
      const businessData = await clients.getBusinessInfo(id);
      setBusinessInfo(businessData.business_info);
    } catch (err) {
      console.error('Error loading business info:', err);
      setError(err.response?.data?.error || 'Failed to load business information');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage('');

      await clients.updateBusinessInfo(id, businessInfo);

      setSuccessMessage('Business information saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error saving business info:', err);
      setError(err.response?.data?.error || 'Failed to save business information');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setBusinessInfo(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addFaq = () => {
    setBusinessInfo(prev => ({
      ...prev,
      faq: [...prev.faq, { question: '', answer: '' }]
    }));
  };

  const updateFaq = (index, field, value) => {
    setBusinessInfo(prev => ({
      ...prev,
      faq: prev.faq.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const removeFaq = (index) => {
    setBusinessInfo(prev => ({
      ...prev,
      faq: prev.faq.filter((_, i) => i !== index)
    }));
  };

  const tabs = [
    { id: 'about', label: 'About Business' },
    { id: 'contact', label: 'Contact Info' },
    { id: 'policies', label: 'Policies' },
    { id: 'faq', label: 'FAQs' },
    { id: 'ai', label: 'AI Instructions' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error && !client) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
        <Button onClick={() => navigate('/clients')}>Back to Clients</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/clients')}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{client?.name}</h1>
            <p className="text-gray-600">{client?.domain || 'No domain set'}</p>
          </div>
          <Badge variant={client?.status === 'active' ? 'success' : 'danger'}>
            {client?.status}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => navigate(`/clients/${id}`)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <Link
            to={`/clients/${id}`}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              window.location.pathname === `/clients/${id}`
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Overview
          </Link>
          <Link
            to={`/clients/${id}/business-info`}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              window.location.pathname === `/clients/${id}/business-info`
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Business Info
          </Link>
        </nav>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-800 text-sm">
          <strong>Note:</strong> This information helps the AI provide accurate, contextual responses about your business.
          The more details you provide, the better the AI can assist your customers.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {/* About Business Tab */}
        {activeTab === 'about' && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">About Your Business</h2>
              <p className="text-sm text-gray-600 mt-1">
                Provide a brief description of your business for the AI to reference
              </p>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Description
                  </label>
                  <textarea
                    value={businessInfo.about_business}
                    onChange={(e) => handleInputChange('about_business', e.target.value)}
                    rows={6}
                    maxLength={1000}
                    placeholder="e.g., We are Bob's Pizza Shop, serving authentic Italian pizza since 1995. We specialize in wood-fired pizzas using fresh, locally-sourced ingredients..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {businessInfo.about_business.length}/1000 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Hours
                  </label>
                  <textarea
                    value={businessInfo.business_hours}
                    onChange={(e) => handleInputChange('business_hours', e.target.value)}
                    rows={4}
                    maxLength={500}
                    placeholder="e.g., Monday-Friday: 11am-10pm&#10;Saturday-Sunday: 12pm-11pm&#10;Closed on major holidays"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {businessInfo.business_hours.length}/500 characters
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Contact Info Tab */}
        {activeTab === 'contact' && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Contact Information</h2>
              <p className="text-sm text-gray-600 mt-1">
                Provide contact details for customer inquiries
              </p>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <Input
                    type="text"
                    value={businessInfo.contact_phone}
                    onChange={(e) => handleInputChange('contact_phone', e.target.value)}
                    placeholder="e.g., (555) 123-4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    value={businessInfo.contact_email}
                    onChange={(e) => handleInputChange('contact_email', e.target.value)}
                    placeholder="e.g., support@yourcompany.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Physical Address
                  </label>
                  <textarea
                    value={businessInfo.contact_address}
                    onChange={(e) => handleInputChange('contact_address', e.target.value)}
                    rows={3}
                    maxLength={300}
                    placeholder="e.g., 123 Main Street, Suite 100, City, State 12345"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Policies Tab */}
        {activeTab === 'policies' && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Business Policies</h2>
              <p className="text-sm text-gray-600 mt-1">
                Define your policies so the AI can provide accurate information
              </p>
            </CardHeader>
            <CardBody>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Return Policy
                  </label>
                  <textarea
                    value={businessInfo.return_policy}
                    onChange={(e) => handleInputChange('return_policy', e.target.value)}
                    rows={4}
                    maxLength={1000}
                    placeholder="e.g., 30-day money-back guarantee on all products. Items must be unused and in original packaging..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {businessInfo.return_policy.length}/1000 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shipping Policy
                  </label>
                  <textarea
                    value={businessInfo.shipping_policy}
                    onChange={(e) => handleInputChange('shipping_policy', e.target.value)}
                    rows={4}
                    maxLength={1000}
                    placeholder="e.g., Free shipping on orders over $50. Standard delivery: 3-5 business days. Express shipping available..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {businessInfo.shipping_policy.length}/1000 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Methods
                  </label>
                  <textarea
                    value={businessInfo.payment_methods}
                    onChange={(e) => handleInputChange('payment_methods', e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="e.g., We accept Visa, Mastercard, American Express, PayPal, and Apple Pay"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {businessInfo.payment_methods.length}/500 characters
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* FAQ Tab */}
        {activeTab === 'faq' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Frequently Asked Questions</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Add common questions and answers for the AI to reference
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={addFaq}
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add FAQ
                </Button>
              </div>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                {businessInfo.faq.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No FAQs added yet.</p>
                    <p className="text-sm mt-2">Click "Add FAQ" to create your first question and answer.</p>
                  </div>
                ) : (
                  businessInfo.faq.map((item, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700">
                          FAQ #{index + 1}
                        </span>
                        <button
                          onClick={() => removeFaq(index)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Question
                          </label>
                          <Input
                            type="text"
                            value={item.question}
                            onChange={(e) => updateFaq(index, 'question', e.target.value)}
                            placeholder="e.g., Do you deliver?"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Answer
                          </label>
                          <textarea
                            value={item.answer}
                            onChange={(e) => updateFaq(index, 'answer', e.target.value)}
                            rows={3}
                            maxLength={500}
                            placeholder="e.g., Yes! We deliver within a 5-mile radius. Minimum order $15."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardBody>
          </Card>
        )}

        {/* AI Instructions Tab */}
        {activeTab === 'ai' && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Custom AI Instructions</h2>
              <p className="text-sm text-gray-600 mt-1">
                Customize how the AI behaves and represents your brand
              </p>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800 text-sm">
                    <strong>Tip:</strong> Use this to define tone, style, priorities, and specific behaviors.
                    For example: "Always mention our daily specials" or "Be enthusiastic about our signature product"
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    AI Behavior Instructions
                  </label>
                  <textarea
                    value={businessInfo.custom_instructions}
                    onChange={(e) => handleInputChange('custom_instructions', e.target.value)}
                    rows={8}
                    maxLength={2000}
                    placeholder="e.g., Always be friendly and enthusiastic. Mention our gluten-free options when customers ask about dietary restrictions. Promote our loyalty program when appropriate. Use a casual, conversational tone..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {businessInfo.custom_instructions.length}/2000 characters
                  </p>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Examples:</h3>
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    <li>Always mention our 24/7 customer support availability</li>
                    <li>Be concise and professional in all responses</li>
                    <li>Prioritize product recommendations based on customer needs</li>
                    <li>Use emojis sparingly to keep tone friendly but professional</li>
                  </ul>
                </div>
              </div>
            </CardBody>
          </Card>
        )}
      </div>

      {/* Floating Save Button (mobile) */}
      <div className="lg:hidden fixed bottom-6 right-6">
        <Button
          onClick={handleSave}
          disabled={saving}
          size="lg"
          className="shadow-lg"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
