import React from 'react';
import { ShieldCheck } from 'lucide-react';

export default function Footer({ isHighContrast, language }) {
  const t = {
    en: {
      disclaimer: "GovtGuide AI is an independent citizen intelligence portal built for welfare eligibility discovery assistance. Real scheme enrollment must be performed on official government domains (.gov.in or .nic.in). This platform never collects Aadhaar, OTP credentials, or bank login passwords.",
      copyright: "© 2026 GovtGuide AI. All rights reserved. Designed for digital citizen inclusion.",
      officialLinkNote: "Always check for verified .gov.in or .nic.in domains before submitting personal files."
    },
    hi: {
      disclaimer: "गोवगाइड एआई कल्याणकारी पात्रता सहायता के लिए बनाया गया एक स्वतंत्र नागरिक पोर्टल है। वास्तविक योजना नामांकन संबंधित आधिकारिक सरकारी डोमेन (.gov.in या .nic.in) पर किया जाना चाहिए। यह प्लेटफ़ॉर्म कभी भी आधार, ओटीपी या बैंक पासवर्ड एकत्र नहीं करता है।",
      copyright: "© 2026 गोवगाइड एआई। सर्वाधिकार सुरक्षित। डिजिटल समावेशन के लिए समर्पित।",
      officialLinkNote: "कोई भी व्यक्तिगत फ़ाइल साझा करने से पहले हमेशा gov.in या nic.in डोमेन की जांच करें।"
    },
    ta: {
      disclaimer: "கோவ்கைட் ஏஐ என்பது நலத்திட்ட தகுதி உதவிக்காக உருவாக்கப்பட்ட ஒரு சுயாதீன தளம் ஆகும். உண்மையான திட்ட பதிவு அதிகாரப்பூர்வ அரசு இணையதளங்களில் (.gov.in அல்லது .nic.in) மட்டுமே செய்யப்பட வேண்டும். இந்த தளம் ஒருபோதும் ஆதார், ஓடிபி அல்லது வங்கி கடவுச்சொற்களை சேகரிப்பதில்லை.",
      copyright: "© 2026 கோவ்கைட் ஏஐ. அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை. டிஜிட்டல் உள்ளடக்கத்திற்காக வடிவமைக்கப்பட்டது.",
      officialLinkNote: "தனிப்பட்ட விவரங்களை பகிரும் முன் எப்போதும் gov.in அல்லது nic.in முகவரியை சரிபார்க்கவும்."
    }
  }[language] || { disclaimer: "GovtGuide AI portal assistance." };

  return (
    <footer className={`py-8 mt-auto border-t transition-all ${
      isHighContrast ? 'bg-black text-yellow-300 border-yellow-300' : 'bg-white text-[#64748B] border-[#E2E8F0]'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          
          {/* Disclaimer details */}
          <div className="flex items-start space-x-3.5 max-w-2xl">
            <div className={`p-2 rounded-xl mt-0.5 flex-shrink-0 ${
              isHighContrast ? 'bg-yellow-300 text-black' : 'bg-[#EFF6FF] text-[#155EEF] border border-[#DBEAFE]'
            }`}>
              <ShieldCheck className="h-5 w-5 text-[#155EEF]" />
            </div>
            <div>
              <p className="text-xs leading-relaxed text-left text-[#172033]">
                <strong className="text-[#155EEF]">Official Disclaimer:</strong> {t.disclaimer}
              </p>
              <p className="text-[11px] text-[#0F766E] text-left font-medium mt-1">
                {t.officialLinkNote}
              </p>
            </div>
          </div>

          {/* Copy info */}
          <div className="text-right text-xs md:pl-6 flex-shrink-0">
            <p className="font-semibold text-[#172033]">{t.copyright}</p>
            <p className="text-[11px] text-[#64748B] mt-1">National Citizen Welfare Platform powered by AI</p>
          </div>

        </div>
      </div>
    </footer>
  );
}
