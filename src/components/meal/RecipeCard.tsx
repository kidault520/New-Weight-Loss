interface RecipeCardProps {
  image: string
  title: string
  description: string
  onClick: () => void
}

export function RecipeCard({ image, title, description, onClick }: RecipeCardProps) {
  return (
    <button 
      className="w-full bg-white rounded-2xl overflow-hidden text-left shadow-sm"
      onClick={onClick}
    >
      <div className="relative">
        <img 
          src={image} 
          alt={title} 
          className="w-full h-32 object-cover"
        />
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="absolute bottom-3 left-3 text-white">
          <h3 className="text-lg font-bold">{title}</h3>
          <p className="text-sm opacity-90">{description}</p>
        </div>
      </div>
    </button>
  )
}














