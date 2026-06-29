import { Link } from 'react-router-dom';
import { ChefHat, Package, ShoppingCart, ArrowRight, TrendingUp, Users, Flame, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { recipes } from '../data/mockData';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { AnimatedNumber } from '../components/AnimatedNumber';

interface HomePageProps {
  dailyCalories: number;
}

export function HomePage({ dailyCalories }: HomePageProps) {
  const { t } = useTranslation();
  const featuredRecipes = recipes.slice(0, 3);

  const features = [
    {
      icon: ChefHat,
      title: t('home.authentic_recipes'),
      description: t('home.authentic_recipes_desc'),
      gradient: 'from-primary to-primary/70',
    },
    {
      icon: Package,
      title: t('home.smart_pantry'),
      description: t('home.smart_pantry_desc'),
      gradient: 'from-secondary to-secondary/70',
    },
    {
      icon: ShoppingCart,
      title: t('home.shopping_lists'),
      description: t('home.shopping_lists_desc'),
      gradient: 'from-accent to-accent/70',
    },
  ];

  const stats = [
    { icon: ChefHat, value: 50, suffix: '+', label: t('home.recipes_stat') },
    { icon: Users, value: 100, suffix: '+', label: t('home.cooks_stat') },
    { icon: Flame, display: '24/7', label: t('home.companion_stat') },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Layered ambient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-muted/30 to-accent/10" />
        <div className="pointer-events-none absolute -top-24 -right-16 w-80 h-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute top-40 -left-24 w-96 h-96 rounded-full bg-primary/20 blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full bg-accent/15 text-accent-foreground border border-accent/30 text-sm font-medium backdrop-blur-sm">
                <Sparkles className="w-4 h-4 text-accent" />
                {t('home.hero_badge')}
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground mb-6 leading-[1.1]">
                {t('home.hero_title')}{' '}
                <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Dasturkhon
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground mb-8 leading-relaxed max-w-xl">
                {t('home.hero_subtitle')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/recipes"
                  className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35 hover:-translate-y-0.5 transition-all duration-300"
                >
                  <ChefHat className="w-5 h-5" />
                  {t('home.explore_recipes')}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="grid grid-cols-2 gap-4">
                {featuredRecipes.map((recipe, index) => (
                  <motion.div
                    key={recipe.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                    whileHover={{ y: -4 }}
                    className={`rounded-3xl overflow-hidden shadow-lg ring-1 ring-black/5 ${index === 0 ? 'col-span-2' : ''}`}
                  >
                    <div className="relative aspect-video group">
                      <ImageWithFallback
                        src={recipe.image}
                        alt={recipe.title}
                        width={index === 0 ? 560 : 270}
                        height={index === 0 ? 315 : 152}
                        loading="eager"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3">
                        <h3 className="text-white text-sm sm:text-base font-medium drop-shadow">{recipe.title}</h3>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-24 bg-card/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground mb-4">
              {t('home.everything_you_need')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('home.everything_subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group"
              >
                <div className="h-full p-8 rounded-3xl bg-card border border-border hover:border-primary/30 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 shadow-md group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-gradient-to-br from-primary to-primary/80 relative overflow-hidden">
        <div className="pointer-events-none absolute -bottom-20 -right-10 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-3 gap-8 text-center">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                {stat.display ? (
                  <div className="text-4xl sm:text-5xl font-semibold text-white mb-2">{stat.display}</div>
                ) : (
                  <AnimatedNumber
                    value={stat.value!}
                    suffix={stat.suffix}
                    className="text-4xl sm:text-5xl font-semibold text-white mb-2"
                  />
                )}
                <div className="text-primary-foreground/80">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative overflow-hidden p-12 rounded-[32px] bg-gradient-to-br from-muted to-accent/20 border border-accent/30"
          >
            <div className="pointer-events-none absolute -top-16 -left-10 w-56 h-56 rounded-full bg-secondary/15 blur-3xl" />
            <div className="relative">
              <div className="w-14 h-14 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground mb-4">
                {t('home.ready_to_transform')}
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                {t('home.ready_subtitle')}
              </p>
              <Link
                to="/recipes"
                className="group inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
              >
                {t('home.get_started')}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
