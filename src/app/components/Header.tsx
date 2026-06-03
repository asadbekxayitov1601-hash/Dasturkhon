import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown, User, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import logo from '../assets/dasturkhon_logo.png';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { t, i18n } = useTranslation();
  const auth = useAuth();

  const navItems = [
    { path: '/', label: t('nav.home') },
    { path: '/recipes', label: t('nav.recipes') },
    { path: '/pantry', label: t('nav.pantry') },
    { path: '/shopping', label: t('nav.shopping') },
  ];

  if (auth.user) {
    navItems.splice(2, 0, { path: '/favorites', label: t('nav.favorites') });
  }

  if (auth.user?.isAdmin) {
    navItems.push({ path: '/admin', label: 'Admin' });
  }

  const languages = [
    { code: 'uz', name: "O'zbek", short: 'UZ', flag: 'https://flagcdn.com/w40/uz.png' },
    { code: 'ru', name: 'Русский', short: 'RU', flag: 'https://flagcdn.com/w40/ru.png' },
    { code: 'en', name: 'English', short: 'EN', flag: 'https://flagcdn.com/w40/gb.png' },
  ];
  const currentLang = languages.find((l) => l.code === i18n.language) || languages[0];

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('dasturxon-language', lng);
    setIsLangMenuOpen(false);
  };

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-primary/10 py-2 shadow-sm transition-all duration-300"
    >
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 transition-all duration-300">
          <Link to="/" className="flex items-center group relative z-10" aria-label="Dasturkhon home">
            <motion.img
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              src={logo}
              alt="Dasturkhon"
              className="h-11 sm:h-14 w-auto object-contain select-none !border-none !outline-none !ring-0 bg-transparent block"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1 bg-white/50 backdrop-blur-sm p-1.5 rounded-full border border-white/20 shadow-sm relative z-10">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative px-5 py-2 rounded-full transition-colors text-sm font-medium ${active ? 'text-primary' : 'text-gray-600 hover:text-primary'
                    }`}
                >
                  {active && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-white shadow-sm rounded-full border border-primary/10"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                      style={{ zIndex: -1 }}
                    />
                  )}
                  <span className="relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3 relative z-10">
            {/* Desktop Actions Group */}
            <div className="hidden lg:flex items-center gap-3">
              <ThemeToggle />
              {/* Language Switcher — frosted-glass dropdown */}
              <div className="relative">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setIsLangMenuOpen((o) => !o)}
                  className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-2xl bg-white/40 backdrop-blur-md border border-white/50 shadow-sm hover:bg-white/60 transition-colors"
                >
                  <img src={currentLang.flag} alt="" className="w-6 h-[18px] rounded-[3px] object-cover shadow-sm" />
                  <span className="text-sm font-medium text-gray-800">{currentLang.name}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isLangMenuOpen ? 'rotate-180' : ''}`} />
                </motion.button>

                <AnimatePresence>
                  {isLangMenuOpen && (
                    <>
                      {/* click-catcher */}
                      <div className="fixed inset-0 z-40" onClick={() => setIsLangMenuOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.97 }}
                        transition={{ duration: 0.18 }}
                        className="absolute right-0 mt-2 w-48 p-1.5 rounded-2xl bg-white/50 backdrop-blur-2xl border border-white/60 shadow-xl z-50"
                      >
                        {languages.map((lang) => {
                          const active = i18n.language === lang.code;
                          return (
                            <button
                              key={lang.code}
                              onClick={() => changeLanguage(lang.code)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${active ? 'bg-white/70 text-primary font-semibold' : 'text-gray-700 hover:bg-white/50'}`}
                            >
                              <img src={lang.flag} alt="" className="w-6 h-[18px] rounded-[3px] object-cover shadow-sm" />
                              <span className="text-sm">{lang.name}</span>
                              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                            </button>
                          );
                        })}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Auth actions */}
              <div>
                {auth.loading ? (
                  <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                ) : auth.user ? (
                  <div className="flex items-center gap-3">
                    <NotificationBell />
                    <Link to="/profile" className="hidden sm:flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-primary transition-colors">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary relative">
                        {auth.user.photoURL ? (
                          <img src={auth.user.photoURL} alt={auth.user.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <User className="w-4 h-4" />
                        )}
                      </div>
                      <span>{auth.user.name?.split(' ')[0] || 'User'}</span>
                    </Link>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => auth.logout()}
                      className="p-2 rounded-full hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors border border-transparent hover:border-red-100"
                      title="Logout"
                    >
                      <LogOut className="w-5 h-5" />
                    </motion.button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link to="/login">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="px-4 py-2 rounded-full transition-colors text-sm font-medium text-gray-700 hover:text-primary hover:bg-primary/5"
                      >
                        Sign in
                      </motion.button>
                    </Link>
                    <Link to="/signup">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="px-5 py-2 rounded-full bg-primary text-white text-sm font-medium shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
                      >
                        Sign up
                      </motion.button>
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile theme toggle */}
            <div className="lg:hidden">
              <ThemeToggle />
            </div>

            {/* Mobile notification bell */}
            {auth.user && (
              <div className="lg:hidden">
                <NotificationBell />
              </div>
            )}

            {/* Mobile Menu Button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`lg:hidden p-2 rounded-full transition-colors relative z-50 text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 [@media(hover:hover)]:hover:bg-gray-100 ${isMobileMenuOpen ? 'bg-gray-100' : 'bg-transparent'
                }`}
              aria-label="Toggle menu"
            >
              <AnimatePresence mode="wait">
                {isMobileMenuOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <X className="w-6 h-6" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Menu className="w-6 h-6" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              <motion.div
                key="mobile-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-0 lg:hidden"
              />
              <motion.div
                key="mobile-menu"
                initial={{ opacity: 0, y: -20, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -20, height: 0 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
                className="lg:hidden fixed top-16 sm:top-20 left-0 right-0 bg-white/95 backdrop-blur-xl border-b border-primary/10 shadow-xl overflow-hidden z-40 rounded-b-3xl"
              >
                <nav className="flex flex-col gap-1 p-4">
                  {navItems.map((item, index) => (
                    <motion.div
                      key={item.path}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Link
                        to={item.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${isActive(item.path)
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-gray-600 hover:bg-gray-50'
                          }`}
                      >
                        {item.label}
                      </Link>
                    </motion.div>
                  ))}

                  <div className="h-px bg-gray-100 my-2" />

                  <p className="text-xs font-semibold text-gray-400 px-4 mb-2 uppercase tracking-wider">Language</p>
                  <div className="grid grid-cols-3 gap-2 px-2">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          changeLanguage(lang.code);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl gap-1 transition-all border ${i18n.language === lang.code
                          ? 'bg-primary/5 border-primary/20 text-primary'
                          : 'bg-white border-gray-100 hover:border-gray-200'
                          }`}
                      >
                        <img src={lang.flag} alt="" className="w-8 h-6 rounded-[3px] object-cover shadow-sm" />
                        <span className="text-xs font-medium">{lang.name.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>

                  {auth.user ? (
                    <>
                      <div className="h-px bg-gray-100 my-2" />
                      <Link
                        to="/profile"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl text-gray-700 hover:bg-gray-50"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary relative">
                          <User className="w-4 h-4" />
                        </div>
                        <span className="font-medium">Profile ({auth.user.name})</span>
                      </Link>
                      <button
                        onClick={() => {
                          auth.logout();
                          setIsMobileMenuOpen(false);
                        }}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl text-red-600 hover:bg-red-50 w-full text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                          <LogOut className="w-4 h-4" />
                        </div>
                        <span className="font-medium">Logout</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="h-px bg-gray-100 my-2" />
                      <div className="grid grid-cols-2 gap-3 px-2">
                        <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>
                          <button className="w-full py-3 rounded-2xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors">
                            Sign in
                          </button>
                        </Link>
                        <Link to="/signup" onClick={() => setIsMobileMenuOpen(false)}>
                          <button className="w-full py-3 rounded-2xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                            Sign up
                          </button>
                        </Link>
                      </div>
                    </>
                  )}
                </nav>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}
