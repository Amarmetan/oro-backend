import React, { useState, useRef } from 'react';
import { api } from '../lib/apiClient';
import {
  X,
  Megaphone,
  Upload,
  Image as ImageIcon,
  Check,
  Send,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

interface AdminAnnouncementModalProps {
  onClose: () => void;
  onSaved: (msg: string) => void;
}

export const AdminAnnouncementModal: React.FC<AdminAnnouncementModalProps> = ({
  onClose,
  onSaved,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [badge, setBadge] = useState('HOT PREMIERE');
  const [mediaUrl, setMediaUrl] = useState('');
  const [actionLink, setActionLink] = useState('https://t.me/OroRecordsBot?start=promo');

  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const [publishing, setPublishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    setUploadingMedia(true);
    setUploadNotice(null);
    try {
      const res = await api.uploadFile(file);
      if (res.success && res.url) {
        setMediaUrl(res.url);
        setUploadNotice(`Media uploaded (${(file.size / 1024).toFixed(1)} KB)`);
      } else {
        setErrorMsg(res.message || 'Media upload failed');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'File upload error');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setErrorMsg('Title and announcement content are required');
      return;
    }

    setPublishing(true);
    setErrorMsg(null);
    try {
      const res = await api.createAnnouncement({
        title: title.trim(),
        content: content.trim(),
        badge: badge.trim() || 'NOTICE',
        media_url: mediaUrl.trim() || undefined,
        action_link: actionLink.trim() || undefined,
      });

      if (res.success) {
        onSaved('Promotional announcement broadcasted successfully!');
        onClose();
      } else {
        setErrorMsg(res.message || 'Failed to broadcast announcement');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to post announcement');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#10141D] border border-purple-500/40 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-[#10141D]/95 backdrop-blur border-b border-gray-800 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider">
                Broadcast Announcement & Media Teaser
              </h2>
              <p className="text-[10px] text-gray-400">
                Publish promotions, movie teasers, and banners directly to buyers
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-gray-300 uppercase mb-1">
                Announcement Headline (Required)
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 🔥 Weekend Premiere: Hunda Dura 2 Drops Tonight!"
                className="w-full px-3 py-2 bg-[#0E121B] border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-300 uppercase mb-1">
                Badge / Tag
              </label>
              <select
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                className="w-full px-3 py-2 bg-[#0E121B] border border-gray-800 rounded-xl text-xs text-purple-300 font-bold focus:outline-none"
              >
                <option value="HOT PREMIERE">HOT PREMIERE</option>
                <option value="PROMO DISCOUNT">PROMO DISCOUNT</option>
                <option value="CREATOR HIGHLIGHT">CREATOR HIGHLIGHT</option>
                <option value="SYSTEM UPDATE">SYSTEM UPDATE</option>
                <option value="VIP EXCLUSIVE">VIP EXCLUSIVE</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-300 uppercase mb-1">
              Announcement Body
            </label>
            <textarea
              rows={3}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write announcement text, release timing, discount details or special Telegram bot perks..."
              className="w-full px-3 py-2 bg-[#0E121B] border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Media / Teaser File Upload */}
          <div className="bg-[#141924] p-3 rounded-xl border border-gray-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-bold text-purple-400 uppercase tracking-wider">
                Promotional Media Banner / Teaser
              </label>
              <span className="text-[9px] text-gray-400">Direct file upload or URL</span>
            </div>

            <input
              ref={mediaInputRef}
              type="file"
              accept="image/*,video/mp4"
              onChange={handleMediaUpload}
              className="hidden"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => mediaInputRef.current?.click()}
                disabled={uploadingMedia}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-lg border border-gray-700 flex items-center gap-1.5 shrink-0 transition"
              >
                <Upload className="w-3.5 h-3.5 text-purple-400" />
                {uploadingMedia ? 'Uploading...' : 'Upload Media'}
              </button>
              <input
                type="text"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="or paste media URL /uploads/promo.jpg"
                className="flex-1 px-3 py-1.5 bg-[#0E121B] border border-gray-800 rounded-lg text-xs text-gray-300 focus:outline-none"
              />
            </div>

            {uploadNotice && (
              <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                <Check className="w-3 h-3" /> {uploadNotice}
              </p>
            )}

            {mediaUrl && (
              <div className="rounded-lg overflow-hidden border border-gray-800 max-h-40 bg-black/40 flex items-center justify-center">
                <img
                  src={mediaUrl}
                  alt="Media preview"
                  className="w-full h-auto max-h-40 object-cover"
                />
              </div>
            )}
          </div>

          {/* Action Link / Deep Link */}
          <div>
            <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1 flex items-center gap-1">
              <Send className="w-3 h-3" /> Call-To-Action Link (Telegram Bot Deep Link)
            </label>
            <input
              type="text"
              value={actionLink}
              onChange={(e) => setActionLink(e.target.value)}
              placeholder="e.g. https://t.me/OroRecordsBot?start=movie_1"
              className="w-full px-3 py-2 bg-[#0E121B] border border-gray-800 rounded-xl text-xs font-mono text-blue-300 focus:outline-none focus:border-blue-500"
            />
            <span className="text-[9px] text-gray-500 mt-1 block">
              When users click this announcement, it deep links them straight to the Telegram Bot!
            </span>
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
              disabled={publishing}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-black rounded-xl transition active:scale-95 shadow flex items-center gap-1.5"
            >
              {publishing ? 'Publishing...' : 'Broadcast to Buyers'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
