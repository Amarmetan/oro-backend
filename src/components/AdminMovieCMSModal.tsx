import React, { useState, useRef } from 'react';
import { Movie } from '../types';
import { api } from '../lib/apiClient';
import {
  X,
  Upload,
  Film,
  Sparkles,
  DollarSign,
  Tag,
  Check,
  Image as ImageIcon,
  Send,
  Video,
  ExternalLink,
} from 'lucide-react';

interface AdminMovieCMSModalProps {
  movieToEdit?: Movie | null;
  existingCategories: string[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}

export const AdminMovieCMSModal: React.FC<AdminMovieCMSModalProps> = ({
  movieToEdit,
  existingCategories,
  onClose,
  onSaved,
}) => {
  const isEditing = !!movieToEdit;

  const [title, setTitle] = useState(movieToEdit?.title || '');
  const [originalTitle, setOriginalTitle] = useState(movieToEdit?.original_title || '');
  const [category, setCategory] = useState(movieToEdit?.category || 'Cultural Drama');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCat, setIsCustomCat] = useState(
    movieToEdit ? !existingCategories.includes(movieToEdit.category) : false
  );
  const [description, setDescription] = useState(movieToEdit?.description || '');
  const [releaseYear, setReleaseYear] = useState(String(movieToEdit?.release_year || new Date().getFullYear()));
  const [quality, setQuality] = useState(movieToEdit?.quality || '1080p FHD');
  const [languages, setLanguages] = useState(movieToEdit?.languages || 'Afan Oromo');

  // Pricing in ETB
  const [regularPrice, setRegularPrice] = useState(String(movieToEdit?.regular_price || '120'));
  const [vipPrice, setVipPrice] = useState(String(movieToEdit?.vip_price || '60'));
  const [discountPercent, setDiscountPercent] = useState(String(movieToEdit?.discount_percent || '0'));
  const [rentalDurationHours, setRentalDurationHours] = useState(String(movieToEdit?.rental_duration_hours || '72'));
  const [allowLifetime, setAllowLifetime] = useState(movieToEdit ? movieToEdit.allow_lifetime === 1 : true);
  const [isPopular, setIsPopular] = useState(movieToEdit ? movieToEdit.is_popular === 1 : false);

  // Media & Telegram File ID
  const [posterUrl, setPosterUrl] = useState(movieToEdit?.poster_url || '');
  const [trailerUrl, setTrailerUrl] = useState(movieToEdit?.trailer_url || '');
  const [fileId, setFileId] = useState(
    movieToEdit?.file_id || `BAACAgQAAxkBAAEPOro_${Date.now()}_oro_rec`
  );
  const [botDeepLink, setBotDeepLink] = useState(
    movieToEdit?.bot_deep_link || (movieToEdit ? `https://t.me/OroRecordsBot?start=movie_${movieToEdit.id}` : '')
  );

  // File Upload State for poster
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [uploadPosterNotice, setUploadPosterNotice] = useState<string | null>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);

  // Submitting
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePosterFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please upload a valid image (PNG or JPEG)');
      return;
    }

    setUploadingPoster(true);
    setUploadPosterNotice(null);
    try {
      const res = await api.uploadFile(file);
      if (res.success && res.url) {
        setPosterUrl(res.url);
        setUploadPosterNotice(`Poster uploaded successfully (${(file.size / 1024).toFixed(1)} KB)`);
      } else {
        setErrorMsg(res.message || 'Poster upload failed');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'File upload error');
    } finally {
      setUploadingPoster(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const effectiveCategory = isCustomCat ? customCategory.trim() : category;
    if (!title.trim()) {
      setErrorMsg('Movie title is required');
      return;
    }
    if (!effectiveCategory) {
      setErrorMsg('Category is required');
      return;
    }

    const reg = parseFloat(regularPrice);
    const vip = parseFloat(vipPrice);
    if (isNaN(reg) || reg <= 0 || isNaN(vip) || vip <= 0) {
      setErrorMsg('Please enter valid positive ETB prices for Regular and VIP');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        title: title.trim(),
        original_title: originalTitle.trim() || title.trim(),
        category: effectiveCategory,
        description: description.trim() || 'Official ORO RECORDS release.',
        poster_url: posterUrl.trim() || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop&q=80',
        trailer_url: trailerUrl.trim(),
        file_id: fileId.trim(),
        regular_price: reg,
        vip_price: vip,
        discount_percent: parseInt(discountPercent, 10) || 0,
        rental_duration_hours: parseInt(rentalDurationHours, 10) || 72,
        allow_lifetime: allowLifetime ? 1 : 0,
        is_popular: isPopular ? 1 : 0,
        release_year: parseInt(releaseYear, 10) || new Date().getFullYear(),
        quality: quality.trim() || '1080p FHD',
        languages: languages.trim() || 'Afan Oromo',
        bot_deep_link: botDeepLink.trim() || undefined,
      };

      if (isEditing && movieToEdit) {
        const res = await api.updateMovieCMS(movieToEdit.id, payload);
        if (res.success) {
          onSaved(`Movie "${payload.title}" updated successfully!`);
          onClose();
        } else {
          setErrorMsg(res.message || 'Failed to update movie');
        }
      } else {
        const res = await api.createMovieCMS(payload);
        if (res.success) {
          onSaved(`Movie "${payload.title}" published to catalog!`);
          onClose();
        } else {
          setErrorMsg(res.message || 'Failed to create movie');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Save operation failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#10141D] border border-amber-500/40 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-[#10141D]/95 backdrop-blur border-b border-gray-800 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider">
                {isEditing ? `CMS Edit: ${movieToEdit?.title}` : 'Upload New Movie — CMS Studio'}
              </h2>
              <p className="text-[10px] text-gray-400">
                Direct catalog publishing, dynamic ETB pricing & Telegram Bot deep links
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {errorMsg && (
            <div className="p-2.5 bg-red-950/70 border border-red-500/40 text-red-300 text-xs rounded-xl">
              {errorMsg}
            </div>
          )}

          {/* Basic Titles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-300 uppercase mb-1">
                Movie Title (Required)
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Hunda Dura"
                className="w-full px-3 py-2 bg-[#0E121B] border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-300 uppercase mb-1">
                Original / Oromo Title
              </label>
              <input
                type="text"
                value={originalTitle}
                onChange={(e) => setOriginalTitle(e.target.value)}
                placeholder="e.g. Hunda Dura Kutaa 2ffaa"
                className="w-full px-3 py-2 bg-[#0E121B] border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Category Selection & Custom Category */}
          <div className="bg-[#141924] p-3 rounded-xl border border-gray-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                Category / Genre
              </label>
              <button
                type="button"
                onClick={() => setIsCustomCat(!isCustomCat)}
                className="text-[10px] text-gray-400 hover:text-amber-300 underline"
              >
                {isCustomCat ? '← Choose Existing Category' : '+ Add Custom Category'}
              </button>
            </div>

            {!isCustomCat ? (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-[#0E121B] border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
              >
                {existingCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-1">
                <input
                  type="text"
                  required
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Type new custom category name (e.g. Historical Epic, Oromo Sci-Fi)"
                  className="w-full px-3 py-2 bg-[#0E121B] border border-amber-500/50 rounded-xl text-xs text-amber-300 focus:outline-none"
                />
                <span className="text-[9px] text-gray-500">
                  New category will be automatically available across catalog filters.
                </span>
              </div>
            )}
          </div>

          {/* Pricing in ETB */}
          <div className="bg-[#141924] p-3 rounded-xl border border-gray-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Pricing Structure (ETB)
              </span>
              <span className="text-[10px] text-gray-400">Instant customer billing</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-0.5">
                  Regular Price (ETB)
                </label>
                <input
                  type="number"
                  min="5"
                  step="5"
                  required
                  value={regularPrice}
                  onChange={(e) => setRegularPrice(e.target.value)}
                  placeholder="120"
                  className="w-full px-2.5 py-1.5 bg-[#0E121B] border border-gray-800 rounded-lg text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-0.5">
                  VIP Price (ETB)
                </label>
                <input
                  type="number"
                  min="5"
                  step="5"
                  required
                  value={vipPrice}
                  onChange={(e) => setVipPrice(e.target.value)}
                  placeholder="60"
                  className="w-full px-2.5 py-1.5 bg-[#0E121B] border border-gray-800 rounded-lg text-xs font-mono font-bold text-emerald-300 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-0.5">
                  Discount (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="90"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 bg-[#0E121B] border border-gray-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
              <label className="flex items-center gap-1.5 text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowLifetime}
                  onChange={(e) => setAllowLifetime(e.target.checked)}
                  className="rounded bg-[#0E121B] border-gray-700 text-amber-500 focus:ring-0"
                />
                Allow Lifetime Pass (1.6x)
              </label>

              <label className="flex items-center gap-1.5 text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPopular}
                  onChange={(e) => setIsPopular(e.target.checked)}
                  className="rounded bg-[#0E121B] border-gray-700 text-amber-500 focus:ring-0"
                />
                Mark as "HOT / Popular"
              </label>
            </div>
          </div>

          {/* Movie Metadata */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">
                Release Year
              </label>
              <input
                type="number"
                value={releaseYear}
                onChange={(e) => setReleaseYear(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#0E121B] border border-gray-800 rounded-lg text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">
                Quality Badge
              </label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#0E121B] border border-gray-800 rounded-lg text-xs text-white"
              >
                <option value="1080p FHD">1080p FHD</option>
                <option value="4K UHD">4K UHD</option>
                <option value="4K HDR">4K HDR</option>
                <option value="720p HD">720p HD</option>
              </select>
            </div>

            <div>
              <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">
                Audio Languages
              </label>
              <input
                type="text"
                value={languages}
                onChange={(e) => setLanguages(e.target.value)}
                placeholder="Afan Oromo"
                className="w-full px-2.5 py-1.5 bg-[#0E121B] border border-gray-800 rounded-lg text-xs text-white"
              />
            </div>
          </div>

          {/* Direct Poster Upload & Preview */}
          <div className="bg-[#141924] p-3 rounded-xl border border-gray-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-bold text-gray-300 uppercase tracking-wider">
                Movie Poster (Direct File Upload or URL)
              </label>
              <span className="text-[9px] text-amber-400">Supports PNG, JPG, WebP</span>
            </div>

            <input
              ref={posterInputRef}
              type="file"
              accept="image/png, image/jpeg, image/jpg, image/webp"
              onChange={handlePosterFileSelect}
              className="hidden"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => posterInputRef.current?.click()}
                disabled={uploadingPoster}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-lg border border-gray-700 flex items-center gap-1.5 shrink-0 transition"
              >
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                {uploadingPoster ? 'Uploading...' : 'Upload Image File'}
              </button>
              <input
                type="text"
                value={posterUrl}
                onChange={(e) => setPosterUrl(e.target.value)}
                placeholder="or paste image URL /uploads/..."
                className="flex-1 px-3 py-1.5 bg-[#0E121B] border border-gray-800 rounded-lg text-xs text-gray-300 focus:outline-none"
              />
            </div>

            {uploadPosterNotice && (
              <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                <Check className="w-3 h-3" /> {uploadPosterNotice}
              </p>
            )}

            {posterUrl && (
              <div className="flex items-center gap-3 p-2 bg-[#0E121B] rounded-lg border border-gray-800">
                <img
                  src={posterUrl}
                  alt="Poster preview"
                  className="w-12 h-16 object-cover rounded border border-gray-700"
                />
                <div className="text-[10px] text-gray-400 truncate max-w-xs">
                  <span className="text-gray-200 font-bold block">Live Poster Preview</span>
                  <span className="font-mono text-gray-500 truncate block">{posterUrl}</span>
                </div>
              </div>
            )}
          </div>

          {/* Telegram Large File ID & Deep Link Integration */}
          <div className="bg-[#141924] p-3.5 rounded-xl border border-blue-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
                <Send className="w-3.5 h-3.5 text-blue-400" /> Full Movie Bot Link & Telegram Delivery
              </label>
              <span className="text-[9px] text-gray-400">Telegram Bot Integration</span>
            </div>

            <div>
              <label className="block text-[9px] font-bold text-gray-300 uppercase mb-1">
                Full Movie Bot Link (Deep Link)
              </label>
              <input
                type="url"
                value={botDeepLink}
                onChange={(e) => setBotDeepLink(e.target.value)}
                placeholder="https://t.me/OroRecordsBot?start=movie_..."
                className="w-full px-3 py-2 bg-[#0E121B] border border-blue-500/40 rounded-xl text-xs font-mono text-blue-200 focus:outline-none"
              />
              <p className="text-[10px] text-gray-400 mt-0.5">
                Direct Telegram URL that launches instant playback and delivery inside the Telegram Bot.
              </p>
            </div>

            <div>
              <label className="block text-[9px] font-bold text-gray-300 uppercase mb-1">
                Telegram Bot Video File ID
              </label>
              <input
                type="text"
                required
                value={fileId}
                onChange={(e) => setFileId(e.target.value)}
                placeholder="e.g. BAACAgQAAxkBAAEPOro_HD01_oro_rec"
                className="w-full px-3 py-2 bg-[#0E121B] border border-gray-800 rounded-xl text-xs font-mono text-gray-300 focus:outline-none focus:border-blue-500"
              />
              <p className="text-[10px] text-gray-400 mt-0.5">
                The Telegram file identifier used by @OroRecordsBot to deliver 2GB+ video files to purchasers.
              </p>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-bold text-gray-300 uppercase mb-1">
              Movie Synopsis / Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter official movie synopsis, creator credits, and cultural background..."
              className="w-full px-3 py-2 bg-[#0E121B] border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-xl transition active:scale-95 shadow flex items-center gap-1.5"
            >
              {saving ? 'Publishing...' : isEditing ? 'Save Changes' : 'Publish to Catalog'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
