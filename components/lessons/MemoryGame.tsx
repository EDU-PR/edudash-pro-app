/**
 * Memory Game Component
 * 
 * Classic memory card matching game.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';

interface MemoryGameProps {
  content: {
    cards: Array<{
      id: string;
      image?: string;
      text?: string;
    }>;
  };
  onComplete: (score: number) => void;
  theme: any;
}

export function MemoryGame({ content, onComplete, theme }: MemoryGameProps) {
  const [cards, setCards] = useState<any[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);

  useEffect(() => {
    // Duplicate and shuffle cards
    const duplicated = [...content.cards, ...content.cards].map((card, index) => ({
      ...card,
      uniqueId: `${card.id}-${index}`,
      pairId: card.id,
    }));
    setCards(duplicated.sort(() => Math.random() - 0.5));
  }, []);

  const handleCardPress = (index: number) => {
    if (flipped.length === 2 || flipped.includes(index) || matched.includes(index)) {
      return;
    }

    const newFlipped = [...flipped, index];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(prev => prev + 1);
      
      const [first, second] = newFlipped;
      if (cards[first].pairId === cards[second].pairId) {
        // Match!
        setMatched(prev => [...prev, first, second]);
        setFlipped([]);

        // Check if game complete
        if (matched.length + 2 === cards.length) {
          const maxMoves = cards.length;
          const score = Math.max(50, Math.round(100 * (1 - moves / maxMoves)));
          setTimeout(() => onComplete(score), 500);
        }
      } else {
        // No match
        setTimeout(() => {
          setFlipped([]);
        }, 1000);
      }
    }
  };

  if (cards.length === 0) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: theme.card }]}>
        <Text style={[styles.movesText, { color: theme.text }]}>Moves: {moves}</Text>
        <Text style={[styles.matchedText, { color: theme.textSecondary }]}>
          {matched.length / 2} / {cards.length / 2} pairs
        </Text>
      </View>

      <View style={styles.grid}>
        {cards.map((card, index) => {
          const isFlipped = flipped.includes(index) || matched.includes(index);
          
          return (
            <TouchableOpacity
              key={card.uniqueId}
              style={[
                styles.card,
                { backgroundColor: theme.cardSecondary },
                isFlipped && { backgroundColor: theme.primary },
                matched.includes(index) && styles.matchedCard,
              ]}
              onPress={() => handleCardPress(index)}
              disabled={isFlipped || matched.includes(index)}
            >
              {isFlipped ? (
                <>
                  {card.image && (
                    <Image source={{ uri: card.image }} style={styles.cardImage} resizeMode="contain" />
                  )}
                  {card.text && (
                    <Text style={styles.cardText}>{card.text}</Text>
                  )}
                </>
              ) : (
                <Text style={styles.cardBack}>?</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  movesText: {
    fontSize: 18,
    fontWeight: '600',
  },
  matchedText: {
    fontSize: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  card: {
    width: 80,
    height: 80,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchedCard: {
    opacity: 0.5,
  },
  cardImage: {
    width: 60,
    height: 60,
  },
  cardText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFF',
  },
  cardBack: {
    fontSize: 32,
    fontWeight: '700',
    color: '#AAA',
  },
});
